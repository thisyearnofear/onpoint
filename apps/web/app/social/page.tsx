import React from "react";
import { SocialFeed } from "../../components/SocialFeed";
import { FarcasterUser } from "../../components/FarcasterUser";

export default function SocialPage() {
    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Feed with integrated discovery */}
                    <div className="lg:col-span-2">
                        <SocialFeed showDiscovery={true} />
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Current User Profile */}
                        <FarcasterUser />
                    </div>
                </div>
            </div>
        </div>
    );
}