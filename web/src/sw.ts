import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
declare let self: ServiceWorkerGlobalScope & {__WB_MANIFEST: Array<{url:string;revision?:string|null}>};
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'),{denylist:[/^\/api\//,/^\/media\//,/^\/auth\//]}));
const authFailure={async fetchDidSucceed({response}:{response:Response}){if(response.status===401||response.status===403)await clearCollectionCaches();return response;}};
function context(request:Request){return (request.headers.get('X-Kratzbaum-Cache-Context')||'public').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)||'public';}
registerRoute(({request,url})=>request.method==='GET'&&url.origin===self.location.origin&&(
 url.pathname==='/api/plants'||/^\/api\/plants\/[a-f0-9-]{36}$/.test(url.pathname)||/^\/api\/plants\/[a-f0-9-]{36}\/activities$/.test(url.pathname)||/^\/api\/plants\/[a-f0-9-]{36}\/photos$/.test(url.pathname)||url.pathname==='/api/today'||url.pathname==='/api/calendar'
),({request,event})=>new NetworkFirst({cacheName:`kratzbaum-data-${context(request)}`,plugins:[new CacheableResponsePlugin({statuses:[200]}),new ExpirationPlugin({maxEntries:120,maxAgeSeconds:1209600,purgeOnQuotaError:true}),authFailure]}).handle({request,event}));
registerRoute(({request,url})=>request.method==='GET'&&url.origin===self.location.origin&&/^\/media\/[a-f0-9-]{36}\/(thumb|original)\.jpg$/.test(url.pathname),({request,event})=>new CacheFirst({cacheName:`kratzbaum-media-${context(request)}`,plugins:[new CacheableResponsePlugin({statuses:[200]}),new ExpirationPlugin({maxEntries:160,maxAgeSeconds:2592000,purgeOnQuotaError:true}),authFailure]}).handle({request,event}));
async function clearCollectionCaches(){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('kratzbaum-data-')||k.startsWith('kratzbaum-media-')).map(k=>caches.delete(k)));}
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')void self.skipWaiting();if(event.data?.type==='CLEAR_COLLECTION')event.waitUntil(clearCollectionCaches());if(event.data?.type==='INVALIDATE_DATA')event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kratzbaum-data-')).map(k=>caches.delete(k)))));if(event.data?.type==='INVALIDATE_MEDIA')event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kratzbaum-media-')).map(k=>caches.delete(k)))));});
