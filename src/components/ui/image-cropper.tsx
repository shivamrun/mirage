"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// ============================================================================
// TYPES
// ============================================================================

type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageDimensions = {
  width: number;
  height: number;
};

type PointerPosition = {
  x: number;
  y: number;
};

type ResizeHandle =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "";

// ============================================================================
// CONSTANTS
// ============================================================================

const CONTAINER_WIDTH = 620;
const CONTAINER_HEIGHT = 460;
const HANDLE_SIZE = 10;
const HANDLE_TOLERANCE = 5;
const MIN_CROP_SIZE = 20;
const MIN_OUTPUT_DIMENSION = 64;
const CROP_KEYBOARD_STEP = 5;
const CROP_KEYBOARD_FAST_STEP = 20;
const JPEG_QUALITIES = [0.92, 0.82, 0.72, 0.62, 0.52, 0.42] as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const calculateDisplaySize = (
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number,
): { displaySize: ImageDimensions; scale: number } => {
  const scaleX = containerWidth / naturalWidth;
  const scaleY = containerHeight / naturalHeight;
  const scale = Math.min(scaleX, scaleY, 1);

  return {
    displaySize: {
      width: naturalWidth * scale,
      height: naturalHeight * scale,
    },
    scale,
  };
};

const calculateInitialCrop = (
  displayWidth: number,
  displayHeight: number,
  aspect: number,
): CropArea => {
  const cropWidthRatio = 0.7;

  let cropWidth = displayWidth * cropWidthRatio;
  let cropHeight = cropWidth / aspect;

  if (cropHeight > displayHeight) {
    cropHeight = displayHeight * cropWidthRatio;
    cropWidth = cropHeight * aspect;
  }

  return {
    x: (displayWidth - cropWidth) / 2,
    y: (displayHeight - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
};

const getResizeHandle = (
  pointerX: number,
  pointerY: number,
  crop: CropArea,
): ResizeHandle => {
  const { x, y, width, height } = crop;
  const tolerance = HANDLE_TOLERANCE;
  const handleSize = HANDLE_SIZE;

  if (
    pointerX >= x - tolerance &&
    pointerX <= x + handleSize + tolerance &&
    pointerY >= y - tolerance &&
    pointerY <= y + handleSize + tolerance
  ) {
    return "top-left";
  }

  if (
    pointerX >= x + width - handleSize - tolerance &&
    pointerX <= x + width + tolerance &&
    pointerY >= y - tolerance &&
    pointerY <= y + handleSize + tolerance
  ) {
    return "top-right";
  }

  if (
    pointerX >= x - tolerance &&
    pointerX <= x + handleSize + tolerance &&
    pointerY >= y + height - handleSize - tolerance &&
    pointerY <= y + height + tolerance
  ) {
    return "bottom-left";
  }

  if (
    pointerX >= x + width - handleSize - tolerance &&
    pointerX <= x + width + tolerance &&
    pointerY >= y + height - handleSize - tolerance &&
    pointerY <= y + height + tolerance
  ) {
    return "bottom-right";
  }

  return "";
};

const isInsideCrop = (
  pointerX: number,
  pointerY: number,
  crop: CropArea,
): boolean => {
  return (
    pointerX >= crop.x &&
    pointerX <= crop.x + crop.width &&
    pointerY >= crop.y &&
    pointerY <= crop.y + crop.height
  );
};

const getCursorStyle = (
  pointerX: number,
  pointerY: number,
  crop: CropArea,
): string => {
  const handle = getResizeHandle(pointerX, pointerY, crop);

  if (handle) {
    if (handle === "top-left" || handle === "bottom-right") {
      return "nwse-resize";
    }

    return "nesw-resize";
  }

  if (isInsideCrop(pointerX, pointerY, crop)) {
    return "move";
  }

  return "default";
};

// ============================================================================
// CROP LOGIC HOOK
// ============================================================================

const useCropLogic = (
  displaySize: ImageDimensions,
  aspect: number,
  isImageLoaded: boolean,
) => {
  const [crop, setCrop] = useState<CropArea>({
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>("");
  const [startPos, setStartPos] = useState<PointerPosition>({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState<CropArea>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (isImageLoaded && displaySize.width > 0 && displaySize.height > 0) {
      const initialCrop = calculateInitialCrop(
        displaySize.width,
        displaySize.height,
        aspect,
      );

      setCrop(initialCrop);
    }
  }, [isImageLoaded, displaySize, aspect]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const previousUserSelect = document.body.style.userSelect;

    document.body.style.userSelect = "none";

    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isDragging, isResizing]);

  const handlePointerDown = (pos: PointerPosition) => {
    const handle = getResizeHandle(pos.x, pos.y, crop);

    if (handle) {
      setIsResizing(true);
      setResizeHandle(handle);
      setStartPos(pos);
      setStartCrop({ ...crop });
      return;
    }

    if (isInsideCrop(pos.x, pos.y, crop)) {
      setIsDragging(true);
      setStartPos(pos);
      setStartCrop({ ...crop });
    }
  };

  const handlePointerMove = (pos: PointerPosition) => {
    if (isResizing) {
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;

      const newCrop = { ...startCrop };

      if (resizeHandle.includes("left")) {
        newCrop.x = startCrop.x + dx;
        newCrop.width = startCrop.width - dx;
      } else if (resizeHandle.includes("right")) {
        newCrop.width = startCrop.width + dx;
      }

      if (resizeHandle.includes("top")) {
        newCrop.y = startCrop.y + dy;
        newCrop.height = startCrop.height - dy;
      } else if (resizeHandle.includes("bottom")) {
        newCrop.height = startCrop.height + dy;
      }

      if (resizeHandle.includes("left") || resizeHandle.includes("right")) {
        newCrop.height = newCrop.width / aspect;

        if (resizeHandle.includes("top")) {
          newCrop.y = startCrop.y + startCrop.height - newCrop.height;
        }
      } else {
        newCrop.width = newCrop.height * aspect;

        if (resizeHandle.includes("left")) {
          newCrop.x = startCrop.x + startCrop.width - newCrop.width;
        }
      }

      if (newCrop.x < 0) {
        newCrop.width += newCrop.x;
        newCrop.height = newCrop.width / aspect;
        newCrop.x = 0;

        if (resizeHandle.includes("top")) {
          newCrop.y = startCrop.y + startCrop.height - newCrop.height;
        }
      }

      if (newCrop.y < 0) {
        newCrop.height += newCrop.y;
        newCrop.width = newCrop.height * aspect;
        newCrop.y = 0;

        if (resizeHandle.includes("left")) {
          newCrop.x = startCrop.x + startCrop.width - newCrop.width;
        }
      }

      if (newCrop.x + newCrop.width > displaySize.width) {
        newCrop.width = displaySize.width - newCrop.x;
        newCrop.height = newCrop.width / aspect;

        if (resizeHandle.includes("top")) {
          newCrop.y = startCrop.y + startCrop.height - newCrop.height;
        }
      }

      if (newCrop.y + newCrop.height > displaySize.height) {
        newCrop.height = displaySize.height - newCrop.y;
        newCrop.width = newCrop.height * aspect;

        if (resizeHandle.includes("left")) {
          newCrop.x = startCrop.x + startCrop.width - newCrop.width;
        }
      }

      if (newCrop.width > MIN_CROP_SIZE && newCrop.height > MIN_CROP_SIZE) {
        setCrop(newCrop);
      }

      return;
    }

    if (isDragging) {
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;

      const newX = Math.max(
        0,
        Math.min(startCrop.x + dx, displaySize.width - startCrop.width),
      );

      const newY = Math.max(
        0,
        Math.min(startCrop.y + dy, displaySize.height - startCrop.height),
      );

      setCrop({
        ...startCrop,
        x: newX,
        y: newY,
      });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle("");
  };

  const moveCropBy = (dx: number, dy: number) => {
    setCrop((currentCrop) => ({
      ...currentCrop,
      x: Math.max(
        0,
        Math.min(currentCrop.x + dx, displaySize.width - currentCrop.width),
      ),
      y: Math.max(
        0,
        Math.min(currentCrop.y + dy, displaySize.height - currentCrop.height),
      ),
    }));
  };

  const resizeCropBy = (delta: number) => {
    setCrop((currentCrop) => {
      const maxWidth = Math.min(displaySize.width, displaySize.height * aspect);
      const nextWidth = Math.max(
        MIN_CROP_SIZE,
        Math.min(currentCrop.width + delta, maxWidth),
      );
      const nextHeight = nextWidth / aspect;
      const centerX = currentCrop.x + currentCrop.width / 2;
      const centerY = currentCrop.y + currentCrop.height / 2;

      return {
        x: Math.max(
          0,
          Math.min(centerX - nextWidth / 2, displaySize.width - nextWidth),
        ),
        y: Math.max(
          0,
          Math.min(centerY - nextHeight / 2, displaySize.height - nextHeight),
        ),
        width: nextWidth,
        height: nextHeight,
      };
    });
  };

  const resetCrop = () => {
    if (displaySize.width <= 0 || displaySize.height <= 0) return;

    const initialCrop = calculateInitialCrop(
      displaySize.width,
      displaySize.height,
      aspect,
    );

    setCrop(initialCrop);
  };

  return {
    crop,
    isDragging,
    isResizing,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    moveCropBy,
    resetCrop,
    resizeCropBy,
  };
};

// ============================================================================
// CANVAS RENDERER
// ============================================================================

const drawCropCanvas = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  crop: CropArea,
  displaySize: ImageDimensions,
  scale: number,
) => {
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  canvas.width = displaySize.width;
  canvas.height = displaySize.height;

  ctx.drawImage(image, 0, 0, displaySize.width, displaySize.height);

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.clearRect(crop.x, crop.y, crop.width, crop.height);

  ctx.drawImage(
    image,
    crop.x / scale,
    crop.y / scale,
    crop.width / scale,
    crop.height / scale,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
  );

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(crop.x + crop.width / 3, crop.y);
  ctx.lineTo(crop.x + crop.width / 3, crop.y + crop.height);
  ctx.moveTo(crop.x + (crop.width * 2) / 3, crop.y);
  ctx.lineTo(crop.x + (crop.width * 2) / 3, crop.y + crop.height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(crop.x, crop.y + crop.height / 3);
  ctx.lineTo(crop.x + crop.width, crop.y + crop.height / 3);
  ctx.moveTo(crop.x, crop.y + (crop.height * 2) / 3);
  ctx.lineTo(crop.x + crop.width, crop.y + (crop.height * 2) / 3);
  ctx.stroke();

  ctx.fillStyle = "#fff";

  const handles = [
    {
      x: crop.x - HANDLE_SIZE / 2,
      y: crop.y - HANDLE_SIZE / 2,
    },
    {
      x: crop.x + crop.width - HANDLE_SIZE / 2,
      y: crop.y - HANDLE_SIZE / 2,
    },
    {
      x: crop.x - HANDLE_SIZE / 2,
      y: crop.y + crop.height - HANDLE_SIZE / 2,
    },
    {
      x: crop.x + crop.width - HANDLE_SIZE / 2,
      y: crop.y + crop.height - HANDLE_SIZE / 2,
    },
  ];

  handles.forEach((handle) => {
    ctx.fillRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE);

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(handle.x, handle.y, HANDLE_SIZE, HANDLE_SIZE);
  });
};

// ============================================================================
// CROP PROCESSOR
// ============================================================================

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Couldn't process the cropped image."));
      },
      type,
      quality,
    );
  });
}

function renderCropCanvas(
  image: HTMLImageElement,
  actualX: number,
  actualY: number,
  actualWidth: number,
  actualHeight: number,
  outputWidth: number,
  outputHeight: number,
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Couldn't process the cropped image.");
  }

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  ctx.drawImage(
    image,
    actualX,
    actualY,
    actualWidth,
    actualHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return canvas;
}

async function createCroppedBlob({
  image,
  crop,
  scale,
  outputType,
  maxFileSizeBytes,
  maxOutputWidth,
  maxOutputHeight,
}: {
  image: HTMLImageElement;
  crop: CropArea;
  scale: number;
  outputType: string;
  maxFileSizeBytes?: number;
  maxOutputWidth?: number;
  maxOutputHeight?: number;
}): Promise<Blob> {
  const actualX = Math.round(crop.x / scale);
  const actualY = Math.round(crop.y / scale);
  const actualWidth = Math.round(crop.width / scale);
  const actualHeight = Math.round(crop.height / scale);

  const qualityCandidates =
    outputType === "image/jpeg" ? JPEG_QUALITIES : [undefined];

  const outputScale = Math.min(
    1,
    maxOutputWidth ? maxOutputWidth / actualWidth : 1,
    maxOutputHeight ? maxOutputHeight / actualHeight : 1,
  );

  let width = Math.max(
    MIN_OUTPUT_DIMENSION,
    Math.round(actualWidth * outputScale),
  );
  let height = Math.max(
    MIN_OUTPUT_DIMENSION,
    Math.round(actualHeight * outputScale),
  );

  while (width >= MIN_OUTPUT_DIMENSION && height >= MIN_OUTPUT_DIMENSION) {
    const canvas = renderCropCanvas(
      image,
      actualX,
      actualY,
      actualWidth,
      actualHeight,
      width,
      height,
    );

    for (const quality of qualityCandidates) {
      const blob = await canvasToBlob(canvas, outputType, quality);

      if (!maxFileSizeBytes || blob.size <= maxFileSizeBytes) {
        return blob;
      }
    }

    width = Math.max(MIN_OUTPUT_DIMENSION, Math.floor(width * 0.85));
    height = Math.max(MIN_OUTPUT_DIMENSION, Math.floor(height * 0.85));

    if (width === MIN_OUTPUT_DIMENSION && height === MIN_OUTPUT_DIMENSION) {
      break;
    }
  }

  const fallbackCanvas = renderCropCanvas(
    image,
    actualX,
    actualY,
    actualWidth,
    actualHeight,
    width,
    height,
  );

  const fallbackQuality =
    outputType === "image/jpeg"
      ? JPEG_QUALITIES[JPEG_QUALITIES.length - 1]
      : undefined;

  return canvasToBlob(fallbackCanvas, outputType, fallbackQuality);
}

const processCrop = async (
  image: HTMLImageElement,
  crop: CropArea,
  scale: number,
  outputType: string,
  maxFileSizeBytes?: number,
  maxOutputWidth?: number,
  maxOutputHeight?: number,
) =>
  createCroppedBlob({
    image,
    crop,
    scale,
    outputType,
    maxFileSizeBytes,
    maxOutputWidth,
    maxOutputHeight,
  });

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type Props = {
  open: boolean;
  imageSrc: string;
  aspect: number;
  outputType?: string;
  maxFileSizeBytes?: number;
  maxOutputWidth?: number;
  maxOutputHeight?: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
  onError?: (error: Error) => void;
};

export function ImageCropper({
  open,
  imageSrc,
  aspect,
  outputType = "image/png",
  maxFileSizeBytes,
  maxOutputWidth,
  maxOutputHeight,
  onCancel,
  onConfirm,
  onError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displaySize, setDisplaySize] = useState<ImageDimensions>({
    width: 0,
    height: 0,
  });
  const [scale, setScale] = useState(1);

  const cropLogic = useCropLogic(displaySize, aspect, isImageLoaded);

  useEffect(() => {
    if (!open) {
      setIsImageLoaded(false);
      setDisplaySize({ width: 0, height: 0 });
      setScale(1);
    }
  }, [open]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;

    if (!canvas || !img || !isImageLoaded) return;

    drawCropCanvas(canvas, img, cropLogic.crop, displaySize, scale);
  }, [cropLogic.crop, displaySize, scale, isImageLoaded]);

  const handleImageLoad = () => {
    const img = imageRef.current;

    if (!img) return;

    const { displaySize: newDisplaySize, scale: newScale } =
      calculateDisplaySize(
        img.naturalWidth,
        img.naturalHeight,
        CONTAINER_WIDTH,
        CONTAINER_HEIGHT,
      );

    setDisplaySize(newDisplaySize);
    setScale(newScale);
    setIsImageLoaded(true);
  };

  const handleImageError = () => {
    setIsImageLoaded(false);
    setDisplaySize({ width: 0, height: 0 });
    setScale(1);
    onError?.(new Error("Choose a valid image file."));
    onCancel();
  };

  const getPointerPos = (clientX: number, clientY: number): PointerPosition => {
    const canvas = canvasRef.current;

    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    e.currentTarget.setPointerCapture(e.pointerId);

    cropLogic.handlePointerDown(getPointerPos(e.clientX, e.clientY));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getPointerPos(e.clientX, e.clientY);

    cropLogic.handlePointerMove(pos);

    const canvas = canvasRef.current;

    if (canvas && !cropLogic.isDragging && !cropLogic.isResizing) {
      canvas.style.cursor = getCursorStyle(pos.x, pos.y, cropLogic.crop);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    cropLogic.handlePointerUp();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!isImageLoaded || isProcessing) return;

    const step = e.shiftKey ? CROP_KEYBOARD_FAST_STEP : CROP_KEYBOARD_STEP;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        cropLogic.moveCropBy(0, step);
        return;
      case "ArrowLeft":
        e.preventDefault();
        cropLogic.moveCropBy(-step, 0);
        return;
      case "ArrowRight":
        e.preventDefault();
        cropLogic.moveCropBy(step, 0);
        return;
      case "ArrowUp":
        e.preventDefault();
        cropLogic.moveCropBy(0, -step);
        return;
      case "+":
      case "=":
        e.preventDefault();
        cropLogic.resizeCropBy(step);
        return;
      case "-":
      case "_":
        e.preventDefault();
        cropLogic.resizeCropBy(-step);
        return;
      default:
        return;
    }
  };

  const handleCropConfirm = async () => {
    const img = imageRef.current;

    if (!img || !isImageLoaded || isProcessing) return;

    try {
      setIsProcessing(true);

      const blob = await processCrop(
        img,
        cropLogic.crop,
        scale,
        outputType,
        maxFileSizeBytes,
        maxOutputWidth,
        maxOutputHeight,
      );

      await onConfirm(blob);
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error
          : new Error("Couldn't process the cropped image."),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v: boolean) => !v && onCancel()}>
      <AlertDialogContent
        className="w-[calc(100vw-2rem)] !max-w-3xl overflow-hidden"
        style={{ padding: "0px" }}
      >
        <div className="flex max-h-[calc(100svh-2rem)] flex-col">
          <AlertDialogHeader className="gap-0 border-b px-6 py-4">
            <AlertDialogTitle className="text-base font-medium">
              Crop image
            </AlertDialogTitle>
            <AlertDialogDescription>
              Drag to reposition. Resize from the corners.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-auto p-6">
            <div className="relative max-w-full p-8">
              <canvas
                ref={canvasRef}
                aria-label="Image crop area"
                tabIndex={0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onLostPointerCapture={cropLogic.handlePointerUp}
                onKeyDown={handleKeyDown}
                className="rounded-lg border border-border bg-white/50 shadow-lg"
                style={{
                  width: displaySize.width,
                  height: displaySize.height,
                  maxWidth: "100%",
                  touchAction: "none",
                }}
              />

              {imageSrc ? (
                // biome-ignore lint/performance/noImgElement: canvas cropper needs direct access to the source image element.
                <img
                  ref={imageRef}
                  src={imageSrc}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  className="hidden"
                  alt="Source"
                />
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={cropLogic.resetCrop}
              disabled={!isImageLoaded || isProcessing}
              className="justify-start"
            >
              Reset Crop
            </Button>

            <div className="flex gap-3 sm:justify-end">
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isProcessing}
              >
                Cancel
              </Button>

              <Button
                onClick={handleCropConfirm}
                disabled={!isImageLoaded || isProcessing}
              >
                {isProcessing ? "Processing..." : "Crop & Continue"}
              </Button>
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
