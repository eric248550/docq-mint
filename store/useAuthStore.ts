import { create } from "zustand"
import { persist } from "zustand/middleware"
import { User } from "firebase/auth"

export type IdentityContext = 'student' | 'school_admin' | 'verifier' | null

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  identityContext: IdentityContext
  selectedSchoolId: string | null
  selectedVerifierId: string | null
  setIdentityContext: (context: IdentityContext, schoolId?: string, verifierId?: string) => void
  clearIdentityContext: () => void
  getAuthToken: () => Promise<string | null>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => {
        set({ user })
        // Clear identity context if user logs out
        if (!user) {
          set({ identityContext: null, selectedSchoolId: null, selectedVerifierId: null })
        }
      },
      isLoading: true,
      setIsLoading: (isLoading) => set({ isLoading }),
      identityContext: null,
      selectedSchoolId: null,
      selectedVerifierId: null,
      setIdentityContext: (context, schoolId, verifierId) =>
        set({
          identityContext: context,
          selectedSchoolId: schoolId || null,
          selectedVerifierId: verifierId || null,
        }),
      clearIdentityContext: () =>
        set({ identityContext: null, selectedSchoolId: null, selectedVerifierId: null }),
      getAuthToken: async () => {
        const { user } = get()
        if (!user) return null
        return await user.getIdToken()
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        identityContext: state.identityContext,
        selectedSchoolId: state.selectedSchoolId,
        selectedVerifierId: state.selectedVerifierId,
      }),
    }
  )
)
