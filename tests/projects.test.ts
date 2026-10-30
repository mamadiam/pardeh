import { describe, expect, it, beforeEach } from 'vitest'
import type { ProjectIndex } from '../src/storage/projects'

// the localStorage index is per-test-file isolated
beforeEach(() => {
  localStorage.clear()
})

describe('project index', () => {
  it('round-trips through localStorage', async () => {
    const { readIndex, writeIndex } = await import('../src/storage/projects')
    const idx: ProjectIndex = {
      activeId: 'a',
      projects: [
        { id: 'a', title: 'Feature', updatedAt: 1 },
        { id: 'b', title: 'Short', updatedAt: 2 },
      ],
    }
    writeIndex(idx)
    expect(readIndex()).toEqual(idx)
  })

  it('readIndex returns null on corrupt json (never blanks the app)', async () => {
    const { readIndex } = await import('../src/storage/projects')
    localStorage.setItem('sf-projects', '{not json')
    expect(readIndex()).toBeNull()
  })

  it('addProject appends', async () => {
    const { addProject } = await import('../src/storage/projects')
    const idx: ProjectIndex = { activeId: 'a', projects: [{ id: 'a', title: 'A', updatedAt: 1 }] }
    const next = addProject(idx, 'b', 'New')
    expect(next.projects.map((p) => p.id)).toEqual(['a', 'b'])
    expect(idx.projects).toHaveLength(1)
  })

  it('renameProject renames only the target', async () => {
    const { renameProject } = await import('../src/storage/projects')
    const idx: ProjectIndex = {
      activeId: 'a',
      projects: [
        { id: 'a', title: 'Old', updatedAt: 1 },
        { id: 'b', title: 'B', updatedAt: 2 },
      ],
    }
    const next = renameProject(idx, 'a', 'Renamed')
    expect(next.projects[0].title).toBe('Renamed')
    expect(next.projects[1].title).toBe('B')
  })

  it('removeProject drops only the target', async () => {
    const { removeProject } = await import('../src/storage/projects')
    const idx: ProjectIndex = {
      activeId: 'a',
      projects: [
        { id: 'a', title: 'A', updatedAt: 1 },
        { id: 'b', title: 'B', updatedAt: 2 },
      ],
    }
    const next = removeProject(idx, 'b')
    expect(next.projects.map((p) => p.id)).toEqual(['a'])
    expect(next.activeId).toBe('a')
  })
})

describe('ensureIndex migration', () => {
  it('builds the index from existing idb records on first run', async () => {
    const { saveDoc, listDocIds, deleteDoc } = await import('../src/storage/db')
    const { loadDoc } = await import('../src/storage/db')
    const { emptyDoc } = await import('../src/core/types')
    const doc = { ...emptyDoc(), meta: { ...emptyDoc().meta, title: 'Migration feature' } }
    await saveDoc('current', doc)
    await saveDoc('p_stored', { ...emptyDoc(), meta: { ...emptyDoc().meta, title: 'Second' } })

    const { ensureIndex } = await import('../src/storage/projects')
    const idx = await ensureIndex()
    expect(idx.projects.map((p) => p.id).sort()).toEqual(['current', 'p_stored'])
    expect(idx.activeId).toBe('current')
    expect(idx.projects.find((p) => p.id === 'current')?.title).toBe('Migration feature')
    // index persisted for next run
    const again = await ensureIndex()
    expect(again.projects).toHaveLength(2)
    // list + delete helpers the app relies on
    expect(await listDocIds()).toContain('p_stored')
    await deleteDoc('p_stored')
    expect(await loadDoc('p_stored')).toBeNull()
  })

  it('skips the index record itself and empty titles get a fallback', async () => {
    const { saveDoc } = await import('../src/storage/db')
    const { emptyDoc } = await import('../src/core/types')
    await saveDoc('current', emptyDoc())
    const { ensureIndex } = await import('../src/storage/projects')
    const idx = await ensureIndex()
    expect(idx.projects[0].title).toBe('Untitled screenplay')
  })
})
