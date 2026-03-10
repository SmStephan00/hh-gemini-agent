import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAppStore = create(
  persist(
    (set) => ({
      searchQuery: '',
      minScore: 55,
      isSearching: false,
      resumeText: '', // ← добавить

      setSearchQuery: (query) => set({ searchQuery: query }),
      setMinScore: (score) => set({ minScore: score }),
      setIsSearching: (status) => set({ isSearching: status }),
      setResumeText: (text) => set({ resumeText: text }), // ← добавить

      resetSettings: () => set({
        searchQuery: '',
        minScore: 55,
        isSearching: false,
        resumeText: '', // ← добавить
      }),
    }),
    {
      name: 'app-settings',
    }
  )
)

export default useAppStore