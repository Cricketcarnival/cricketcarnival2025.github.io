
import React from 'react';

interface HeaderProps {
    title: string;
    onBack?: () => void;
    actions?: React.ReactNode;
}

const Header: React.FC<HeaderProps> = ({ title, onBack, actions }) => {
    return (
        <header className="bg-blue-600 dark:bg-blue-800 text-white p-4 shadow-md flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center">
                {onBack && (
                    <button onClick={onBack} className="mr-4 text-white hover:bg-blue-700 dark:hover:bg-blue-900 rounded-full p-2">
                        <i className="fas fa-arrow-left"></i>
                    </button>
                )}
                <h1 className="text-xl font-bold">{title}</h1>
            </div>
            <div>{actions}</div>
        </header>
    );
};

export default Header;
