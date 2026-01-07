import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getUserMemberships } from '@/lib/middleware/auth';
import { IdentityContext } from '@/lib/db/types';

/**
 * POST /api/users/identity
 * Set user's identity context (student or school_admin)
 * This is a client-side preference, not enforced server-side
 * Server-side permissions are based on actual school_memberships.role
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (authContext) => {
    const { dbUser } = authContext;

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { context, schoolId } = body as { 
      context: IdentityContext; 
      schoolId?: string 
    };

    // Validate context
    if (!['student', 'school_admin'].includes(context)) {
      return NextResponse.json(
        { error: 'Invalid identity context' },
        { status: 400 }
      );
    }

    // Get user's memberships to validate
    const memberships = await getUserMemberships(dbUser.id);

    // If school_admin context, verify user has appropriate role
    if (context === 'school_admin') {
      const hasAdminRole = memberships.some(
        m => ['owner', 'admin'].includes(m.role) && 
             (!schoolId || m.school_id === schoolId)
      );
      
      if (!hasAdminRole) {
        return NextResponse.json(
          { error: 'User does not have admin privileges' },
          { status: 403 }
        );
      }
    }

    // If student context, verify user has student role
    if (context === 'student') {
      const hasStudentRole = memberships.some(
        m => m.role === 'student' && (!schoolId || m.school_id === schoolId)
      );
      
      if (!hasStudentRole) {
        return NextResponse.json(
          { error: 'User is not a student' },
          { status: 403 }
        );
      }
    }

    // Return success - identity is stored client-side
    return NextResponse.json({
      success: true,
      context,
      schoolId,
    });
  });
}

