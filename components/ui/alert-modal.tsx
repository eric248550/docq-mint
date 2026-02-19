'use client';

import { useState } from 'react';

export type ModalState = {
  isOpen: boolean;
  message: string;
  type: 'alert' | 'confirm';
  resolve: (value: boolean) => void;
};

export function useModal() {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    message: '',
    type: 'alert',
    resolve: () => {},
  });

  const showAlert = (message: string): Promise<void> =>
    new Promise((resolve) => {
      setModal({ isOpen: true, message, type: 'alert', resolve: () => resolve() });
    });

  const showConfirm = (message: string): Promise<boolean> =>
    new Promise((resolve) => {
      setModal({ isOpen: true, message, type: 'confirm', resolve });
    });

  const closeModal = (confirmed: boolean) => {
    setModal((prev) => {
      prev.resolve(confirmed);
      return { ...prev, isOpen: false };
    });
  };

  return { modal, showAlert, showConfirm, closeModal };
}

interface ModalProps {
  isOpen: boolean;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm: () => void;
  onCancel: () => void;
}

export function Modal({ isOpen, message, type, onConfirm, onCancel }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <p className="text-sm text-gray-700 whitespace-pre-line">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          {type === 'confirm' && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
