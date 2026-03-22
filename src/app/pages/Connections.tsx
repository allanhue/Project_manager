import React, { useState } from 'react';

interface Connection {
    id: string;
    name: string;
    type: string;
    status: 'connected' | 'disconnected';
    lastSync?: Date;
}

export default function Connections() {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', type: '' });

    const handleAddConnection = () => {
        const newConnection: Connection = {
            id: Date.now().toString(),
            name: formData.name,
            type: formData.type,
            status: 'disconnected',
        };
        setConnections([...connections, newConnection]);
        setFormData({ name: '', type: '' });
        setShowForm(false);
    };

    const handleSync = (id: string) => {
        setConnections(
            connections.map((conn) =>
                conn.id === id ? { ...conn, lastSync: new Date() } : conn
            )
        );
    };

    const handleDelete = (id: string) => {
        setConnections(connections.filter((conn) => conn.id !== id));
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Connections</h1>

            <button
                onClick={() => setShowForm(!showForm)}
                className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                Add Connection
            </button>

            {showForm && (
                <div className="mb-6 p-4 border rounded bg-gray-50">
                    <input
                        type="text"
                        placeholder="Connection Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="block mb-2 p-2 border rounded w-full"
                    />
                    <input
                        type="text"
                        placeholder="Application Type"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="block mb-2 p-2 border rounded w-full"
                    />
                    <button
                        onClick={handleAddConnection}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                        Create
                    </button>
                </div>
            )}

            <div className="space-y-4">
                {connections.map((conn) => (
                    <div key={conn.id} className="p-4 border rounded bg-white shadow">
                        <h3 className="font-semibold">{conn.name}</h3>
                        <p className="text-sm text-gray-600">Type: {conn.type}</p>
                        <p className="text-sm text-gray-600">
                            Last Sync: {conn.lastSync?.toLocaleString() || 'Never'}
                        </p>
                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={() => handleSync(conn.id)}
                                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                            >
                                Sync
                            </button>
                            <button
                                onClick={() => handleDelete(conn.id)}
                                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {connections.length === 0 && (
                <p className="text-gray-500 text-center mt-8">No connections yet</p>
            )}
        </div>
    );
}