'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { SchoolsList } from './SchoolsList';
import { SchoolDetails } from './SchoolDetails';
import { DocumentsList } from './DocumentsList';
import { MembersList } from './MembersList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SchoolAdminDashboard() {
  const { selectedSchoolId } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

  if (!selectedSchoolId) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No school selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SchoolDetails schoolId={selectedSchoolId} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Recent Documents</h3>
              <DocumentsList schoolId={selectedSchoolId} limit={5} />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Members</h3>
              <MembersList schoolId={selectedSchoolId} limit={5} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsList schoolId={selectedSchoolId} />
        </TabsContent>

        <TabsContent value="members">
          <MembersList schoolId={selectedSchoolId} />
        </TabsContent>

        <TabsContent value="settings">
          <SchoolDetails schoolId={selectedSchoolId} editable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

