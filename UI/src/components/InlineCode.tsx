interface InlineCodeProps {
    children: React.ReactNode;
    color?: 'green' | 'red' | 'yellow' | 'blue';
}

export function InlineCode({ children, color = 'yellow' }: InlineCodeProps) {
    const colorClasses = {
        yellow: "text-yellow-200 border-yellow-700",
        green: "text-green-200 border-green-700",
        red: "text-red-200 border-red-700",
        blue: "text-blue-200 border-blue-700",
    };

    return (
        <code className={`bg-gray-800 px-1.5 py-0.5 rounded text-xs border ${colorClasses[color]}`}>
            {children}
        </code>
    );
}