import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMedia, get, send, uploadPhoto } from './api';
import type { Plant, SpeciesCandidate } from './api';
import { Identification, photoTypes } from './Identification';

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
  const [source, setSource] = useState<File | string | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const pending = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  const review = useRef<HTMLDivElement>(null);
  const busyChange = useCallback((value: boolean) => { pending.current = value; setIdentifying(value); onBusyChange(value); }, [onBusyChange]);
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
  const busy = uploading || identifying || disabled;
  return <>
    <section aria-label="Species identification">
      <div ref={review} tabIndex={-1} className="identification-source">
        <input ref={picker} hidden type="file" aria-label="Photo for species identification" accept={photoTypes} disabled={busy || offline || !available} onChange={e => {
          const file = e.target.files?.[0]; e.target.value = '';
          if (file) setSource(file);
        }}/>
        <button type="button" className="secondary" disabled={busy || offline || !available} onClick={() => picker.current?.click()}>Choose identification photo</button>
        {source && <p className="muted">{typeof source === 'string' ? 'Selected saved gallery photo' : source.name}</p>}
        <Identification source={source} plantID={plant.id} available={available} offline={offline} disabled={uploading || disabled} onConfirm={confirm} onBusyChange={busyChange}/>
      </div>
    </section>
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
      <div className="photo-grid">{photos.map(photo => <article key={photo.id} className="photo-card">
        <CachedImage src={photo.filename} alt={'Photo of ' + plant.name}/>
        <div className="photo-actions">
          <button type="button" className="text-button" disabled={busy || offline || !available} onClick={() => { setSource(photo.id); review.current?.focus(); review.current?.scrollIntoView({ block: 'nearest' }); }}>Identify this photo</button>
          <button type="button" className="text-button" disabled={busy || offline || plant.cover_photo_id === photo.id} onClick={async () => {
            try { await send(`/api/plants/${plant.id}/cover`, { photo_id: photo.id }, 'PUT'); onChanged(); }
            catch (e) { setError(String(e)); }
          }}>{plant.cover_photo_id === photo.id ? 'Cover photo' : 'Set cover'}</button>
          <button type="button" className="delete-button" aria-label="Delete photo" disabled={busy || offline} onClick={async () => {
            if (!window.confirm('Delete this plant photo?')) return;
            try { await send(`/api/plants/${plant.id}/photos/${photo.id}`, undefined, 'DELETE'); if (source === photo.id) setSource(null); await refresh(); onChanged(); }
            catch (e) { setError(String(e)); }
          }}>×</button>
        </div>
      </article>)}</div>
      {photos.length === 0 && <p className="muted">Add a photo to recognize your plant at a glance.</p>}
    </section>
  </>;
}
