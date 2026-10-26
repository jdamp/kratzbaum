export type ActivityType = 'watering' | 'fertilizing' | 'photo' | 'note';

export interface Plant {
  id: string;
  room_id?: string | null;
  name: string;
  scientific_name: string;
  common_name: string;
  family: string;
  notes: string;
  created_at: string;
  care_start_date: string;
  watering_interval_days: number;
  summer_fertilizing_interval_days: number | null;
  winter_fertilizing_interval_days: number | null;
  summer_fertilizing_paused?: boolean;
  winter_fertilizing_paused?: boolean;
  cover_photo_id: string;
  next_watering?: string;
  next_fertilizing?: string | null;
  photo_url?: string;
  photo_count: number;
}

export interface Activity {
  id: string;
  plant_id: string;
  plant_name: string;
  type: ActivityType;
  occurred_at: string;
  note?: string;
  actor_name?: string;
  photo_url?: string;
}

export interface DueCare {
  plant_id: string;
  plant_name: string;
  photo_url?: string;
  room_id?: string | null;
  type: 'watering' | 'fertilizing';
  due_date: string;
  days_overdue: number;
  days_until: number;
}

export interface Room {
  id: string;
  name: string;
}

export interface NotStartedCare {
  plant_id: string;
  plant_name: string;
  photo_url?: string;
  room_id?: string | null;
  type: 'watering' | 'fertilizing';
  interval_days: number;
}

export interface TodayResponse {
  date: string;
  computed_at: string;
  timezone: string;
  season: 'summer' | 'winter';
  due: DueCare[];
  next: DueCare[];
  not_started: NotStartedCare[];
}

export interface CalendarResponse {
  month: string;
  timezone: string;
  activities: Activity[];
  due: DueCare[];
}

export interface Bootstrap {
  name: string;
  auth_mode: 'no' | 'oidc';
  authenticated: boolean;
  identity: string;
  display_name?: string;
  csrf_token: string;
  plantnet_available: boolean;
  timezone: string;
  offline: boolean;
  login_url?: string;
}

export interface PlantInput {
  name: string;
  scientific_name: string;
  common_name: string;
  family: string;
  notes: string;
  care_start_date: string;
  room_id?: string | null;
  watering_interval_days: number;
  summer_fertilizing_interval_days: number | null;
  winter_fertilizing_interval_days: number | null;
  summer_fertilizing_paused?: boolean;
  winter_fertilizing_paused?: boolean;
}

export const activityLabels: Record<ActivityType, string> = {
  watering: 'Watering',
  fertilizing: 'Fertilizing',
  photo: 'Photo',
  note: 'Care note',
};

export const activityStyles: Record<ActivityType, string> = {
  watering: 'water',
  fertilizing: 'fertilize',
  photo: 'photo',
  note: 'note',
};

let cacheContext = 'public';
let csrfToken = '';
const sessionChannel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('kratzbaum-session');

function cacheSuffix(context:string){return (context||'public').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)||'public'}

export function setRequestContext(identity: string, csrf: string) {
  const prior=cacheSuffix(cacheContext),next=cacheSuffix(identity||'public');
  cacheContext = identity || 'public';
  csrfToken = csrf;
  if(prior!==next)void purgeOtherIdentityCaches(next);
  if(prior!==next)sessionChannel?.postMessage({type:'IDENTITY_CHANGED',identity:next});
}

sessionChannel?.addEventListener('message',event=>{if(event.data?.type==='LOGOUT'||(event.data?.type==='IDENTITY_CHANGED'&&event.data.identity!==cacheSuffix(cacheContext))){void clearLocalCollection(false);window.dispatchEvent(new CustomEvent('kratzbaum:access-denied'))}});

async function purgeOtherIdentityCaches(keep:string){try{const names=await caches.keys();await Promise.all(names.filter(n=>(n.startsWith('kratzbaum-data-')&&!n.endsWith(`-${keep}`))||(n.startsWith('kratzbaum-media-')&&!n.endsWith(`-${keep}`))).map(n=>caches.delete(n)))}catch{/* CacheStorage may be unavailable. */}}
async function invalidateReadCache(){try{const names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith('kratzbaum-data-')).map(n=>caches.delete(n)));navigator.serviceWorker?.controller?.postMessage({type:'INVALIDATE_DATA'})}catch{/* CacheStorage may be unavailable. */}}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Kratzbaum-Cache-Context', cacheContext);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const method = (options.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !navigator.onLine) {
    throw new ApiError('You’re offline. Changes are not saved; reconnect and try again.', 0);
  }
  let response: Response;
  try {
    response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError('You’re offline. Check your connection and try again.', 0);
  }
  if (!response.ok) {
    let message = `Something went wrong (${response.status}).`;
    let code: string | undefined;
    try {
      const body = await response.json();
      message = body.error || message;
      code = body.code;
    } catch {
      // The useful request status still reaches the screen.
    }
    if (response.status === 401 || response.status === 403) {
      await clearLocalCollection();
      window.dispatchEvent(new CustomEvent('kratzbaum:access-denied'));
    }
    throw new ApiError(message, response.status, code);
  }
  if(!['GET','HEAD','OPTIONS'].includes(method)){await invalidateReadCache();if(method==='DELETE'&&path.includes('/photos/')){try{const names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith('kratzbaum-media-')).map(n=>caches.delete(n)));navigator.serviceWorker?.controller?.postMessage({type:'INVALIDATE_MEDIA'})}catch{/* CacheStorage may be unavailable. */}}}
  if(response.status===204)return undefined as T;
  return response.json() as Promise<T>;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function send<T>(path: string, body?: unknown, method = 'POST', extraHeaders: HeadersInit = {}): Promise<T> {
  return request<T>(path, {
    method,
    headers: extraHeaders,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function uploadPhoto(plantID: string, file: File) {
  const form = new FormData();
  form.append('image', file);
  return request<unknown>(`/api/plants/${plantID}/photos`, { method: 'POST', body: form });
}

export interface SpeciesCandidate {
  scientific_name: string;
  common_names: string[] | null;
  score: number;
}

export interface IdentificationResult {
  attempt_id: string;
  status: 'succeeded' | 'no_match' | 'failed';
  candidates: SpeciesCandidate[] | null;
  error_code?: string;
  error?: string;
}

function identifyFile(path: string, file: File, attemptKey: string) {
  const body = new FormData();
  body.append('image', file);
  return request<IdentificationResult>(path, { method: 'POST', body, headers: { 'Idempotency-Key': attemptKey } });
}

export const identifyDraft = (file: File, attemptKey: string) => identifyFile('/api/identifications', file, attemptKey);
export const identifyPlantFile = (plantID: string, file: File, attemptKey: string) => identifyFile(`/api/plants/${plantID}/photos/identify`, file, attemptKey);
export const identifySavedPhoto = (plantID: string, photoID: string, attemptKey: string) =>
  request<IdentificationResult>(`/api/plants/${plantID}/photos/${photoID}/identify`, { method: 'POST', headers: { 'Idempotency-Key': attemptKey } });

export async function fetchMedia(path:string):Promise<string>{const headers=new Headers({'X-Kratzbaum-Cache-Context':cacheContext});let response:Response;try{response=await fetch(path,{headers,credentials:'same-origin'})}catch{throw new ApiError('This photo is not available offline yet.',0)}if(response.status===401||response.status===403){await clearLocalCollection();window.dispatchEvent(new CustomEvent('kratzbaum:access-denied'));throw new ApiError('Sign in is required to view this photo.',response.status)}if(!response.ok)throw new ApiError('Could not load this photo.',response.status);return URL.createObjectURL(await response.blob())}

export async function clearLocalCollection(broadcast=true) {
  try{localStorage.removeItem('kratzbaum-context')}catch{/* Local storage may be unavailable. */}
  try {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('kratzbaum-')).map(name => caches.delete(name)));
    await navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_COLLECTION' });
  } catch {
    // Browsers without CacheStorage have no local response cache to remove.
  }
  setRequestContext('public', '');
  if(broadcast)sessionChannel?.postMessage({type:'LOGOUT'});
}

export async function finishPendingLogout():Promise<boolean>{try{await send('/auth/logout',undefined,'POST');localStorage.removeItem('kratzbaum-local-logout');return true}catch{return false}}
