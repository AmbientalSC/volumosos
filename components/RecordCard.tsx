import React, { memo, useState, useCallback, useRef, useMemo } from 'react';
import { PhotoRecord } from '../types';
import { LocationMarkerIcon, CalendarIcon } from './Icons';

interface RecordCardProps {
  record: PhotoRecord;
  isSelected: boolean;
  onTap: (record: PhotoRecord) => void;
  onDelete: (record: PhotoRecord) => void;
}

const formatDate = (date: Date) => ({
  date: date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' }),
  time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
});

const SWIPE_THRESHOLD = 80;

const RecordCard: React.FC<RecordCardProps> = memo(({ record, isSelected, onTap, onDelete }) => {
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const { date, time } = useMemo(() => formatDate(record.timestamp), [record.timestamp]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      isSwiping.current = true;
      setSwipeX(Math.min(0, Math.max(-SWIPE_THRESHOLD * 2, dx)));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeX < -SWIPE_THRESHOLD) {
      onDelete(record);
    }
    setSwipeX(0);
  }, [swipeX, onDelete, record]);

  const handleClick = useCallback(() => {
    if (!isSwiping.current) {
      onTap(record);
    }
  }, [onTap, record]);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {swipeX < 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center bg-red-500 px-4" style={{ width: Math.abs(swipeX) }}>
          <span className="text-white text-xs font-bold">Excluir</span>
        </div>
      )}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className={`bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer select-none border-2 shrink-0 ${
          isSelected ? 'border-teal-500 bg-teal-50' : 'border-transparent'
        }`}
        style={{ transform: swipeX !== 0 ? `translateX(${swipeX}px)` : undefined, transition: 'transform 0.2s ease' }}
      >
        <img
          src={record.imageUrl}
          alt=""
          className="object-cover w-full h-48 sm:h-56 bg-slate-100"
          loading="lazy"
        />
        <div className="p-4 flex flex-col flex-grow">
          <div className="flex items-start gap-3 mb-2">
            <LocationMarkerIcon className="h-5 w-5 text-teal-500 flex-shrink-0 mt-0.5" />
            <p className="text-slate-700 font-medium text-sm leading-tight line-clamp-2">{record.address}</p>
          </div>
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-teal-500 flex-shrink-0" />
            <p className="text-slate-600 text-xs sm:text-sm">{date} as {time}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

RecordCard.displayName = 'RecordCard';

export default RecordCard;
