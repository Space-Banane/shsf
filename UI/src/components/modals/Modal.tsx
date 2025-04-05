import React, { useEffect } from "react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: string;
    isLoading?: boolean;
}

function Modal({ isOpen, onClose, title, children, maxWidth = "md", isLoading = false }: ModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isLoading) onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose, isLoading]);

    if (!isOpen) return null;

    const maxWidthClass = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
    }[maxWidth] || 'max-w-md';

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 animate-fadeIn p-4">
            <div className={`bg-gray-800 text-white rounded-lg shadow-xl ${maxWidthClass} w-full animate-slideIn flex flex-col max-h-[90vh]`}>
                <div className="flex justify-between items-center p-6 border-b border-gray-700">
                    <h2 className="text-2xl font-semibold">{title}</h2>
                    {!isLoading && (
                        <button 
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-200 text-2xl transition-colors"
                        >
                            ×
                        </button>
                    )}
                </div>
                <div className="overflow-y-auto py-4 px-4 relative" style={{ scrollbarWidth: 'thin' }}>
                    {isLoading && (
                        <div className="absolute inset-0 bg-gray-800/50 flex items-center justify-center z-10">
                            <div className="loader"></div>
                        </div>
                    )}
                    {children}
                </div>
            </div>
        </div>
    );
}

export default Modal;
