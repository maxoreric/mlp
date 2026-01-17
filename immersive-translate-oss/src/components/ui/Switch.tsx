import React from 'react'

interface SwitchProps {
    checked: boolean
    onChange: (checked: boolean) => void
    label?: string
    disabled?: boolean
    className?: string
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled = false, className = '' }) => {
    return (
        <label className={`inline-flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
            <div className="relative">
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(e) => !disabled && onChange(e.target.checked)}
                    disabled={disabled}
                />
                <div
                    className={`block w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${checked ? 'bg-primary-500' : 'bg-gray-200'
                        }`}
                ></div>
                <div
                    className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${checked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                ></div>
            </div>
            {label && <span className="ml-3 text-sm font-medium text-gray-700 select-none">{label}</span>}
        </label>
    )
}
