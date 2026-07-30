import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, EmptyState, PageLoader, Select, cx } from '../components/ui';
import { ApiError, api, getAccessToken } from '../lib/api';
import { useReference } from '../lib/reference';
import type { Photo } from '../lib/types';

const MAX_PHOTOS = 8;

export function Photos() {
  const queryClient = useQueryClient();
  const { data: reference } = useReference();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photosQuery = useQuery({
    queryKey: ['my-photos'],
    queryFn: () => api<{ photos: Photo[] }>('/photos/mine').then((r) => r.photos),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['my-photos'] });
    void queryClient.invalidateQueries({ queryKey: ['my-profile'] });
  };

  /**
   * Uploads go through `fetch` directly rather than the shared client because
   * FormData needs the browser to set its own multipart boundary.
   */
  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      const body = new FormData();
      body.append('photo', file);

      const token = getAccessToken();
      const res = await fetch('/api/photos', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new ApiError(res.status, 'UPLOAD_FAILED', payload.error?.message ?? 'Upload failed.');
      }

      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not upload that photo.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api(`/photos/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : 'That change did not save.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/photos/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  if (photosQuery.isLoading) return <PageLoader />;

  const photos = photosQuery.data ?? [];
  const atLimit = photos.length >= MAX_PHOTOS;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/profile" className="mb-4 inline-block text-sm text-ink-500 hover:text-crimson-700">
        ← Back to your profile
      </Link>

      <h1 className="font-display text-3xl font-bold">Your photos</h1>
      <p className="mt-2 text-ink-500">
        Profiles with photos get far more interest. You can control who sees each one.
      </p>

      <div className="mt-6 space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        <Alert tone="info" title="Before you upload">
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>New photos are checked by a moderator before other members see them.</li>
            <li>
              We re-save every image, which removes hidden data your phone attaches — including the
              location the photo was taken.
            </li>
            <li>Clear photos of your face do better than group shots or sunglasses.</li>
          </ul>
        </Alert>
      </div>

      {/* Upload */}
      <div className="mt-6">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id="photo-upload"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        <label
          htmlFor="photo-upload"
          className={cx(
            'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            atLimit
              ? 'cursor-not-allowed border-paper-300 bg-paper-100 text-ink-400'
              : 'border-crimson-200 bg-crimson-50/50 hover:border-crimson-400 hover:bg-crimson-50',
          )}
        >
          <span className="text-3xl" aria-hidden="true">
            📷
          </span>
          <span className="mt-2 font-medium">
            {uploading
              ? 'Uploading…'
              : atLimit
                ? `You have reached the limit of ${MAX_PHOTOS} photos`
                : 'Choose a photo to upload'}
          </span>
          <span className="mt-1 text-sm text-ink-500">
            JPEG, PNG or WebP · up to 6MB · {photos.length} of {MAX_PHOTOS} used
          </span>
        </label>
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="🖼️"
            title="No photos yet"
            description="Add at least one so people can put a face to your profile."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="card overflow-hidden">
              <div className="relative">
                <img
                  src={photo.url}
                  alt={photo.caption ?? 'Your photo'}
                  className="aspect-square w-full bg-paper-200 object-cover"
                />
                {photo.isPrimary && (
                  <span className="absolute top-2 left-2 rounded-full bg-crimson-700 px-2.5 py-1 text-xs font-medium text-white">
                    Main photo
                  </span>
                )}
                {photo.moderationStatus !== 'APPROVED' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink-950/55 p-4 text-center">
                    <span className="text-sm font-medium text-white">
                      {photo.moderationStatus === 'PENDING'
                        ? 'Waiting for a moderator to review'
                        : 'Not approved — please try another photo'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      photo.moderationStatus === 'APPROVED'
                        ? 'green'
                        : photo.moderationStatus === 'PENDING'
                          ? 'marigold'
                          : 'crimson'
                    }
                  >
                    {photo.moderationStatus === 'APPROVED'
                      ? 'Live'
                      : photo.moderationStatus === 'PENDING'
                        ? 'In review'
                        : 'Rejected'}
                  </Badge>
                </div>

                <Select
                  aria-label="Who can see this photo"
                  value={photo.visibility}
                  onChange={(e) => update.mutate({ id: photo.id, patch: { visibility: e.target.value } })}
                  options={reference?.photoVisibilities ?? []}
                />

                <div className="flex gap-2">
                  {!photo.isPrimary && photo.moderationStatus === 'APPROVED' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => update.mutate({ id: photo.id, patch: { isPrimary: true } })}
                    >
                      Make main
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      if (window.confirm('Delete this photo?')) remove.mutate(photo.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
