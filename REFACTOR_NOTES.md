# Refactor Notes: page.tsx Component Breakdown

## Status: Deferred - Requires Manual Implementation

The `src/app/page.tsx` file is 1005 lines and should be broken down into smaller, more manageable components. This is a complex refactor that requires careful manual work due to the tight coupling of state and logic.

## Recommended Component Extraction

### 1. AppHeader Component ✅ (Created)
- **File**: `src/components/AppHeader.tsx`
- **Status**: Created and ready to use
- **Purpose**: Extracted header/navigation logic
- **Props**: activeTab, onTabChange, unreadCount, account info

### 2. StudioCanvas Component (Requires Manual Work)
- **Purpose**: Extract the canvas rendering and collaboration UI
- **Complexity**: High - has many props and complex state dependencies
- **Challenges**:
  - Complex prop interface with 30+ properties
  - Tight coupling with parent state (worldOffset, scrollPos, etc.)
  - Room collaboration logic mixed with canvas rendering
  - Type errors when extracting due to prop mismatches

### 3. CanvasScrollHandler (Custom Hook)
- **Purpose**: Extract infinite canvas scroll logic (lines 336-451)
- **Complexity**: Medium
- **Suggested approach**: Create `useInfiniteCanvas` hook
- **State to extract**: worldOffset, scrollPos, viewSize, scroll handlers

### 4. ArtistList Component
- **Purpose**: Extract artist/collaborator list rendering (lines 453-475)
- **Complexity**: Low
- **Props**: artists array, selfArtistId

### 5. StudioTabContent Component
- **Purpose**: Extract the studio tab's main content area
- **Complexity**: High
- **Would contain**: Canvas, toolbar, layer panel, room control

## Implementation Strategy

1. **Start with the AppHeader** - Already created, just needs to be integrated
2. **Extract custom hooks first** - Move scroll logic to `useInfiniteCanvas`
3. **Extract simple components** - ArtistList, EdgePointers
4. **Gradually extract complex components** - StudioCanvas last
5. **Test after each extraction** - Run typecheck and manual testing

## Integration Steps

Once components are extracted:

1. Update `src/app/page.tsx` imports
2. Replace inline JSX with component references
3. Pass props correctly
4. Verify all functionality still works
5. Run `npm run typecheck` to ensure no type errors

## Why This Was Deferred

- The component has complex interdependencies that make extraction error-prone
- Type safety issues arose during initial extraction attempt
- Requires manual testing to ensure no regressions
- Better to do this as a focused refactoring session rather than part of a broader sweep

## Next Steps

When ready to complete this refactor:

1. Review the created `AppHeader.tsx` component
2. Integrate it into `page.tsx`
3. Create the `useInfiniteCanvas` hook for scroll logic
4. Extract simpler components first (ArtistList, EdgePointers)
5. Gradually work toward extracting StudioCanvas
6. Test thoroughly at each step
