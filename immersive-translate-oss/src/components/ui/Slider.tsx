import React from 'react'

interface SliderProps {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    step?: number
    label?: string
    formatValue?: (val: number) => string
    className?: string
}

export const Slider: React.FC<SliderProps> = ({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    label,
    formatValue = (v) => v.toString(),
    className = ''
}) => {
    return (
        <div className={`space-y-1 ${className}`}>
            <div className="flex justify-between items-center mb-1">
                {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
                <span className="text-sm text-gray-500 font-mono">{formatValue(value)}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
        </div>
    )
}
