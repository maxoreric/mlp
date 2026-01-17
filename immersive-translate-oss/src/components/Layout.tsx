import React from 'react'
import { Icons } from './ui/Icons'

interface NavItem {
    id: string
    label: string
    icon: React.ReactNode
}

interface LayoutProps {
    children: React.ReactNode
    activeTab: string
    onTabChange: (tabId: string) => void
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
    const navItems: NavItem[] = [
        { id: 'general', label: '常规设置', icon: <Icons.Settings className="w-5 h-5" /> },
        { id: 'video', label: '视频字幕', icon: <Icons.Video className="w-5 h-5" /> },
        { id: 'developer', label: '开发者', icon: <Icons.Code className="w-5 h-5" /> },
    ]

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 fixed h-full z-10">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                        <div className="bg-primary-500 text-white p-1.5 rounded-lg">
                            <Icons.Globe className="w-6 h-6" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Immersive</h1>
                    </div>
                </div>

                <nav className="p-4 space-y-1">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${activeTab === item.id
                                ? 'bg-primary-50 text-primary-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <span className={`${activeTab === item.id ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'}`}>
                                {item.icon}
                            </span>
                            <span>{item.label}</span>
                            {activeTab === item.id && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
                            )}
                        </button>
                    ))}
                </nav>

                <div className="absolute bottom-0 w-full p-4 border-t border-gray-100">
                    <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs text-slate-500 text-center">
                            OSS Version 1.0.0
                        </p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 min-w-0">
                <div className="max-w-4xl mx-auto p-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
