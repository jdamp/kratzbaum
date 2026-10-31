import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fetchMedia, get, send, uploadPhoto } from './api';
import type { Plant, SpeciesCandidate } from './api';
import { IdentificationReview, useIdentification, photoTypes } from './Identification';
import { formatNumber } from './locale';

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
  const [loading, setLoading] = useState(true);
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
    get<{ photos: Photo[] }>(`/api/plants/${plant.id}/photos`).then(result => { if (active) setPhotos(result.photos); }).catch(e => { if (active) setError(e instanceof ApiError ? e.message : 'Fotos konnten nicht geladen werden.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; onBusyChange(false); };
  }, [plant.id, onBusyChange]);
  const confirm = async (candidate: SpeciesCandidate) => {
    const { plant: latest } = await get<{ plant: Plant }>(`/api/plants/${plant.id}`);
    const { wikipedia_url: _override, ...input } = latest;
    await send(`/api/plants/${plant.id}`, { ...input, scientific_name: candidate.scientific_name, common_name: candidate.common_names?.[0] || latest.common_name }, 'PUT');
    onChanged();
  };
  const identification = useIdentification({ plantID: plant.id, available, offline, disabled: uploading || disabled, onConfirm: confirm, onBusyChange: busyChange });
  const busy = uploading || identification.busy || disabled;
  const galleryPhotos = [...photos].sort((a, b) => Number(b.id === plant.cover_photo_id) - Number(a.id === plant.cover_photo_id));
  useEffect(() => {
    if (!identification.source) { lastTrigger.current?.focus(); return; }
    review.current?.focus();
    review.current?.scrollIntoView({ block: 'nearest' });
  }, [identification.source]);
  return <>
    <section className="gallery">
      <div className="section-title">Fotos <span>{formatNumber(photos.length)}</span><label className="text-button">{uploading ? 'Wird hochgeladen…' : '＋ Foto hinzufügen'}
        <input hidden type="file" accept={photoTypes} disabled={busy || offline} onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = '';
          if (!file || pending.current) return;
          pending.current = true; setUploading(true); onBusyChange(true); setError('');
          try { await uploadPhoto(plant.id, file); await refresh(); onChanged(); }
          catch (e) { setError(e instanceof ApiError ? e.message : 'Das Foto konnte nicht hochgeladen werden.'); }
          finally { pending.current = false; setUploading(false); onBusyChange(false); }
        }}/>
      </label></div>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status" className="muted">Fotos werden geladen…</p>}
      <div className="photo-grid">{galleryPhotos.map((photo, index) => <article key={photo.id} className={'photo-card' + (plant.cover_photo_id === photo.id ? ' is-cover' : '')} aria-label={"Galeriefoto " + (index + 1)}>
        <CachedImage src={plant.cover_photo_id === photo.id ? photo.filename.replace('/thumb.jpg', '/original.jpg') : photo.filename} alt={'Foto von ' + plant.name}/>
        <div className="photo-actions">
          <button type="button" className="text-button" disabled={busy || offline || !available} onClick={event => { lastTrigger.current = event.currentTarget; void identification.start(photo.id); review.current?.focus(); review.current?.scrollIntoView({ block: 'nearest' }); }}>Pflanze auf diesem Foto bestimmen</button>
          <button type="button" className="text-button" disabled={busy || offline || plant.cover_photo_id === photo.id} onClick={async () => {
            try { await send(`/api/plants/${plant.id}/cover`, { photo_id: photo.id }, 'PUT'); onChanged(); }
            catch (e) { setError(e instanceof ApiError ? e.message : 'Das Titelbild konnte nicht geändert werden.'); }
          }}>{plant.cover_photo_id === photo.id ? 'Titelbild' : 'Als Titelbild festlegen'}</button>
          <button type="button" className="delete-button" aria-label="Foto löschen" disabled={busy || offline} onClick={async () => {
            if (!window.confirm('Dieses Pflanzenfoto löschen?')) return;
            try { await send(`/api/plants/${plant.id}/photos/${photo.id}`, undefined, 'DELETE'); if (identification.source === photo.id) identification.cancel(); await refresh(); onChanged(); }
            catch (e) { setError(e instanceof ApiError ? e.message : 'Das Foto konnte nicht gelöscht werden.'); }
          }}>×</button>
        </div>
      </article>)}</div>
      {(identification.source || identification.unavailable) && <section aria-label="Pflanzenbestimmung" ref={review} tabIndex={-1} className="identification-source">
        {identification.source && <p className="muted">Bestimmung anhand von Galeriefoto {galleryPhotos.findIndex(photo => photo.id === identification.source) + 1}</p>}
        <IdentificationReview controller={identification}/>
      </section>}
      {!loading && !error && photos.length === 0 && <p className="muted">Füge ein Foto hinzu, um deine Pflanze auf einen Blick zu erkennen.</p>}
    </section>
  </>;
}
