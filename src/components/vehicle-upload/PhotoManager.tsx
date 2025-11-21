/**
 * Photo Manager Component
 * Organize vehicle photos with drag-drop reordering
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.7: Photo Organization and Management
 */

'use client';

import { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Image as ImageIcon, Star, Trash2, Eye, GripVertical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Photo {
  id: string;
  thumbnailUrl: string;
  mediumUrl: string;
  displayOrder: number;
  isMainPhoto: boolean;
  isFeatured: boolean;
  qualityScore?: number;
}

interface PhotoManagerProps {
  vehicleId: string;
  photos: Photo[];
  onPhotosReordered?: (photos: Photo[]) => void;
  onPhotoDeleted?: (photoId: string) => void;
}

function SortablePhoto({
  photo,
  onSetMain,
  onToggleFeatured,
  onDelete,
  onPreview
}: {
  photo: Photo;
  onSetMain: (id: string) => void;
  onToggleFeatured: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (photo: Photo) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      {/* Photo Preview */}
      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative">
        <img
          src={photo.thumbnailUrl}
          alt="Vehicle photo"
          className="w-full h-full object-cover"
        />

        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 bg-black/50 text-white p-1 rounded cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Main Photo Badge */}
        {photo.isMainPhoto && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-blue-500">
              <Star className="h-3 w-3 mr-1 fill-white" />
              Main
            </Badge>
          </div>
        )}

        {/* Featured Badge */}
        {photo.isFeatured && !photo.isMainPhoto && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-yellow-500">
              Featured
            </Badge>
          </div>
        )}

        {/* Quality Score */}
        {photo.qualityScore && (
          <div className="absolute bottom-2 left-2">
            <Badge variant="secondary" className="text-xs">
              Quality: {photo.qualityScore}/100
            </Badge>
          </div>
        )}

        {/* Action Buttons */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onPreview(photo)}
          >
            <Eye className="h-4 w-4" />
          </Button>

          {!photo.isMainPhoto && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onSetMain(photo.id)}
            >
              <Star className="h-4 w-4" />
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={() => onToggleFeatured(photo.id)}
            className={photo.isFeatured ? 'bg-yellow-500' : ''}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDelete(photo.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Order Number */}
      <div className="absolute -top-2 -left-2 bg-gray-900 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
        {photo.displayOrder + 1}
      </div>
    </div>
  );
}

export function PhotoManager({
  vehicleId,
  photos: initialPhotos,
  onPhotosReordered,
  onPhotoDeleted
}: PhotoManagerProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = photos.findIndex(p => p.id === active.id);
      const newIndex = photos.findIndex(p => p.id === over.id);

      const newPhotos = [...photos];
      const [movedPhoto] = newPhotos.splice(oldIndex, 1);
      newPhotos.splice(newIndex, 0, movedPhoto);

      // Update display order
      const reorderedPhotos = newPhotos.map((photo, index) => ({
        ...photo,
        displayOrder: index
      }));

      setPhotos(reorderedPhotos);

      if (onPhotosReordered) {
        onPhotosReordered(reorderedPhotos);
      }
    }
  };

  const handleSetMain = (photoId: string) => {
    const updatedPhotos = photos.map(photo => ({
      ...photo,
      isMainPhoto: photo.id === photoId
    }));
    setPhotos(updatedPhotos);

    if (onPhotosReordered) {
      onPhotosReordered(updatedPhotos);
    }
  };

  const handleToggleFeatured = (photoId: string) => {
    const updatedPhotos = photos.map(photo =>
      photo.id === photoId
        ? { ...photo, isFeatured: !photo.isFeatured }
        : photo
    );
    setPhotos(updatedPhotos);

    if (onPhotosReordered) {
      onPhotosReordered(updatedPhotos);
    }
  };

  const handleDelete = (photoId: string) => {
    const updatedPhotos = photos.filter(p => p.id !== photoId);
    setPhotos(updatedPhotos);

    if (onPhotoDeleted) {
      onPhotoDeleted(photoId);
    }
  };

  const mainPhoto = photos.find(p => p.isMainPhoto);
  const featuredCount = photos.filter(p => p.isFeatured).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-500" />
              <span>Kelola Foto</span>
            </div>
            <div className="flex gap-2 text-sm">
              <Badge variant="secondary">
                {photos.length} foto
              </Badge>
              {featuredCount > 0 && (
                <Badge className="bg-yellow-500">
                  {featuredCount} featured
                </Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription>
            Drag foto untuk mengatur urutan, set foto utama, dan highlight foto featured
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-900">
            <p className="font-medium mb-2">Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Drag foto untuk mengatur urutan tampilan</li>
              <li>Klik <Star className="h-3 w-3 inline" /> untuk set sebagai foto utama</li>
              <li>Klik <ImageIcon className="h-3 w-3 inline" /> untuk highlight sebagai featured</li>
              <li>Klik <Eye className="h-3 w-3 inline" /> untuk preview ukuran penuh</li>
            </ul>
          </div>

          {/* Photo Grid with Drag-Drop */}
          {photos.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={photos.map(p => p.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {photos.map((photo) => (
                    <SortablePhoto
                      key={photo.id}
                      photo={photo}
                      onSetMain={handleSetMain}
                      onToggleFeatured={handleToggleFeatured}
                      onDelete={handleDelete}
                      onPreview={setPreviewPhoto}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Belum ada foto</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={previewPhoto.mediumUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
            />
            <Button
              onClick={() => setPreviewPhoto(null)}
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
