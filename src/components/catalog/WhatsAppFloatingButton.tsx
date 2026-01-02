'use client';

import React, { useState, useEffect } from 'react';
import { FaWhatsapp } from 'react-icons/fa';

interface WhatsAppFloatingButtonProps {
    phoneNumber: string;
    tenantName: string;
    logoUrl?: string | null;
}

export default function WhatsAppFloatingButton({
    phoneNumber,
    tenantName,
    logoUrl,
}: WhatsAppFloatingButtonProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Show after 2 seconds
        const timer = setTimeout(() => setIsVisible(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    if (!phoneNumber || !isVisible) return null;

    const handleWhatsAppClick = () => {
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        const message = encodeURIComponent(`Halo ${tenantName}, saya ingin bertanya tentang kendaraan Anda.`);
        window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 group animate-in fade-in slide-in-from-bottom-5 duration-500">
            {/* Tooltip / Label */}
            <div className="bg-white px-4 py-2 rounded-lg shadow-xl border border-gray-100 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <p className="text-sm font-semibold text-gray-800">Tanya {tenantName} via WhatsApp</p>
            </div>

            {/* Main Button */}
            <button
                onClick={handleWhatsAppClick}
                className="relative flex items-center justify-center w-16 h-16 bg-green-500 text-white rounded-full shadow-2xl hover:bg-green-600 hover:scale-110 transition-all duration-300 overflow-hidden"
            >
                {/* If logo exists, show it in a small bubble next to it or as the background */}
                {logoUrl ? (
                    <div className="absolute inset-0 w-full h-full p-1 bg-white">
                        <img
                            src={logoUrl}
                            alt={tenantName}
                            className="w-full h-full object-contain rounded-full"
                        />
                        {/* Small WhatsApp badge */}
                        <div className="absolute bottom-0 right-0 bg-green-500 p-1 rounded-full border-2 border-white shadow-sm">
                            <FaWhatsapp className="w-3 h-3 text-white" />
                        </div>
                    </div>
                ) : (
                    <FaWhatsapp className="w-8 h-8" />
                )}

                {/* Pulse effect */}
                <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20 -z-10"></div>
            </button>
        </div>
    );
}
