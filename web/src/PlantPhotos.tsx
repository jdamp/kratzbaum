import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMedia, get, send, uploadPhoto } from './api';
import type { Plant, SpeciesCandidate } from './api';
import { IdentificationReview, useIdentification, photoTypes } from './Identification';

export function CachedImage({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true, objectURL = '';
    setUrl('');
    fetchMedia(src).then(value => {
      objectURL = value;
      if (active) setUrl(value); else URL.revokeObjectURL(value);
    }).catch(() => { if (active) setUrl(''); });
    return () => { active = false; if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [src]);
  return url ? <img src={url} alt={alt} loading="lazy" onError={() => setUrl('')}/> : <span role="img" aria-label={alt}>🌿</span>;
}

type Photo = { id: string; filename: string; created_at: string };

export function PlantPhotos({ plant, available, offline, disabled = false, onChanged, onBusyChange }: {
  plant: Plant; available: boolean; offline: boolean; disabled?: boolean; onChanged: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const pending = useRef(false);
  const review = useRef<HTMLElement>(null);
  const lastTrigger = useRef<HTMLButtonElement>(null);
  const busyChange = useCallback((value: boolean) => { pending.current = value; onBusyChange(value); }, [onBusyChange]);
  const refresh = async () => {
    const result = await get<{ photos: Photo[] }>(`/api/plants/${plant.id}/photos`);
    setPhotos(result.photos);
  };
  useEffect(() => {
    let active = true;
    get<{ photos: Photo[] }>(`/api/plants/${plant.id}/photos`).then(result => { if (active) setPhotos(result.photos); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load photos'); });
    return () => { active = false; onBusyChange(false); };
  }, [plant.id, onBusyChange]);
  const confirm = async (candidate: SpeciesCandidate) => {
    const { plant: latest } = await get<{ plant: Plant }>(`/api/plants/${plant.id}`);
    await send(`/api/plants/${plant.id}`, { ...latest, scientific_name: candidate.scientific_name, common_name: candidate.common_names?.[0] || latest.common_name }, 'PUT');
    onChanged();
  };
  const identification = useIdentification({ plantID: plant.id, available, offline, disabled: uploading || disabled, onConfirm: confirm, onBusyChange: busyChange });
  const busy = uploading || identification.busy || disabled;
  useEffect(() => {
    if (!identification.source) { lastTrigger.current?.focus(); return; }
    review.current?.focus();
    review.current?.scrollIntoView({ block: 'nearest' });
  }, [identification.source]);
  return <>
    <section className="gallery">
      <div className="section-title">Photos <span>{photos.length}</span><label className="text-button">{uploading ? 'Uploading…' : '＋ Add photo'}
        <input hidden type="file" accept={photoTypes} disabled={busy || offline} onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = '';
          if (!file || pending.current) return;
          pending.current = true; setUploading(true); setError('');
          try { await uploadPhoto(plant.id, file); await refresh(); onChanged(); }
          catch (e) { setError(e instanceof Error ? e.message : 'Photo upload failed'); }
          finally { pending.current = false; setUploading(false); }
        }}/>
      </label></div>
      {error && <p role="alert">{error}</p>}
      <div className="photo-grid">{photos.map((photo, index) => <article key={photo.id} className="photo-card" aria-label={"Gallery photo " + (index + 1)}>
        <CachedImage src={photo.filename} alt={'Photo of ' + plant.name}/>
        <div className="photo-actions">
          <button type="button" className="text-button" disabled={busy || offline || !available} onClick={event => { lastTrigger.current = event.currentTarget; void identification.start(photo.id); review.current?.focus(); review.current?.scrollIntoView({ block: 'nearest' }); }}>Identify this photo</button>
          <button type="button" className="text-button" disabled={busy || offline || plant.cover_photo_id === photo.id} onClick={async () => {
            try { await send(`/api/plants/${plant.id}/cover`, { photo_id: photo.id }, 'PUT'); onChanged(); }
            catch (e) { setError(String(e)); }
          }}>{plant.cover_photo_id === photo.id ? 'Cover photo' : 'Set cover'}</button>
          <button type="button" className="delete-button" aria-label="Delete photo" disabled={busy || offline} onClick={async () => {
            if (!window.confirm('Delete this plant photo?')) return;
            try { await send(`/api/plants/${plant.id}/photos/${photo.id}`, undefined, 'DELETE'); if (identification.source === photo.id) identification.cancel(); await refresh(); onChanged(); }
            catch (e) { setError(String(e)); }
          }}>×</button>
        </div>
      </article>)}</div>
      {(identification.source || identification.unavailable) && <section aria-label="Species identification" ref={review} tabIndex={-1} className="identification-source">
        {identification.source && <p className="muted">Identifying gallery photo {photos.findIndex(photo => photo.id === identification.source) + 1}</p>}
        <IdentificationReview controller={identification}/>
      </section>}
      {photos.length === 0 && <p className="muted">Add a photo to recognize your plant at a glance.</p>}
    </section>
  </>;
}
