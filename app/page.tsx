'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { AuthExample } from "@/components/AuthExample";
import { GraduationCap, Building2, FileText, Shield } from "lucide-react";
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/identity');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center p-8 md:p-24 min-h-[70vh]">
        <div className="max-w-4xl w-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              DOCQ Mint
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground">
              Academic Document Management & Verification
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Secure document storage and management for schools and students.
              Upload, verify, and access academic records with confidence.
            </p>
          </div>
          
          {/* Auth Component */}
          <div className="w-full max-w-md mx-auto">
            <AuthExample />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-8 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Built for Schools and Students
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* School Admin Feature */}
            <div className="bg-background border rounded-lg p-6 space-y-3">
              <div className="p-3 bg-primary/10 rounded-lg w-fit">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">School Management</h3>
              <p className="text-sm text-muted-foreground">
                Create and manage schools, invite students, and organize documents efficiently.
              </p>
            </div>

            {/* Document Upload Feature */}
            <div className="bg-background border rounded-lg p-6 space-y-3">
              <div className="p-3 bg-primary/10 rounded-lg w-fit">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Document Upload</h3>
              <p className="text-sm text-muted-foreground">
                Securely upload academic documents to AWS S3 with automatic file hashing.
              </p>
            </div>

            {/* Student Access Feature */}
            <div className="bg-background border rounded-lg p-6 space-y-3">
              <div className="p-3 bg-primary/10 rounded-lg w-fit">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Student Portal</h3>
              <p className="text-sm text-muted-foreground">
                Students can view and download their documents anytime, anywhere.
              </p>
            </div>

            {/* Security Feature */}
            <div className="bg-background border rounded-lg p-6 space-y-3">
              <div className="p-3 bg-primary/10 rounded-lg w-fit">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Secure & Verified</h3>
              <p className="text-sm text-muted-foreground">
                Firebase Authentication and PostgreSQL ensure data security and integrity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-8">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">Ready to get started?</h2>
          <p className="text-lg text-muted-foreground">
            Sign up now to create your school or access your documents as a student.
          </p>
        </div>
      </section>
    </main>
  );
}

