import React from 'react'

interface Option {
    value: string
    label: string
}

interface SelectProps {
    value: string
    onChange: (value: string) => void
    options: Option[]
    label?: string
    disabled?: boolean
    className?: string
}

export const Select: React.FC<SelectProps> = ({ value, onChange, options, label, disabled = false, className = '' }) => {
    return (
        <div className={`space-y-1 ${className}`}>
            {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 transition-colors"
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    )
}
