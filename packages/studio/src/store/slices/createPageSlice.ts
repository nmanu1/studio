import { ComponentStateKind, PageState, PropValues } from "@yext/studio-plugin";
import path from "path-browserify";
import initialStudioData from "virtual:yext-studio";
import PageSlice, { PageSliceStates } from "../models/slices/PageSlice";
import { SliceCreator } from "../models/utils";

const firstPageEntry = Object.entries(
  initialStudioData.pageNameToPageState
)?.[0];

const initialStates: PageSliceStates = {
  pages: initialStudioData.pageNameToPageState,
  activePageName: firstPageEntry?.[0],
  activeEntityFile: firstPageEntry?.[1]?.["entityFiles"]?.[0],
  activeComponentUUID: undefined,
  pendingChanges: {
    pagesToRemove: new Set<string>(),
    pagesToUpdate: new Set<string>(),
  },
};

export const createPageSlice: SliceCreator<PageSlice> = (set, get) => {
  const pageActions = {
    addPage: (filepath: string) => {
      if (!filepath) {
        console.error("Error adding page: a filepath is required.");
        return false;
      }
      const pagesPath = initialStudioData.userPaths.pages;
      if (!path.isAbsolute(filepath) || !filepath.startsWith(pagesPath)) {
        console.error(`Error adding page: filepath is invalid: ${filepath}`);
        return false;
      }
      const pageName = path.basename(filepath, ".tsx");
      if (get().pages[pageName]) {
        console.error(
          `Error adding page: page name "${pageName}" is already used.`
        );
        return false;
      }

      set((store) => {
        store.pages[pageName] = {
          componentTree: [],
          cssImports: [],
          filepath,
        };
        store.pendingChanges.pagesToUpdate.add(pageName);
      });
      get().setActivePageName(pageName);
      return true;
    },
    removePage: (pageName: string) => {
      set((store) => {
        delete store.pages[pageName];
        if (pageName === store.activePageName) {
          get().setActivePageName(undefined);
        }
        const { pagesToRemove, pagesToUpdate } = store.pendingChanges;
        pagesToUpdate.delete(pageName);
        pagesToRemove.add(pageName);
      });
    },
  };

  const activePageActions = {
    setActivePageName: (activePageName: string | undefined) => {
      if (activePageName === undefined || get().pages[activePageName]) {
        set({ activePageName, activeComponentUUID: undefined });
      } else {
        console.error(
          `Error in setActivePage: Page "${activePageName}" is not found in Store. Unable to set it as active page.`
        );
      }
    },
    setActivePageState: (pageState: PageState) =>
      set((store) => {
        if (!store.activePageName) {
          console.error(
            "Tried to setActivePageState when activePageName was undefined"
          );
          return;
        }
        if (
          !pageState.componentTree.find(
            (component) => component.uuid === store.activeComponentUUID
          )
        ) {
          store.activeComponentUUID = undefined;
        }
        store.pages[store.activePageName] = pageState;
        store.pendingChanges.pagesToUpdate.add(store.activePageName);
      }),
    getActivePageState: () => {
      const { pages, activePageName } = get();
      if (!activePageName) {
        return;
      }
      return pages[activePageName];
    },
  };

  const activeComponentActions = {
    setActiveComponentUUID: (activeComponentUUID: string | undefined) =>
      set({ activeComponentUUID }),
    getActiveComponentState: () => {
      const { activeComponentUUID, getActivePageState } = get();
      const activePageState = getActivePageState();
      if (!activeComponentUUID || !activePageState) {
        return undefined;
      }
      return activePageState.componentTree.find(
        (component) => component.uuid === activeComponentUUID
      );
    },
    setActiveComponentProps: (props: PropValues) =>
      set((store) => {
        const activePageName = store.activePageName;
        if (!activePageName) {
          console.error(
            "Tried to setActiveComponentProps when activePageName was undefined"
          );
          return;
        }
        const activeComponent = get().getActiveComponentState();
        if (!activeComponent) {
          console.error(
            "Error in setActiveComponentProps: No active component selected in store."
          );
          return;
        }
        const components = store.pages[activePageName].componentTree;
        components.forEach((c) => {
          if (c.uuid === activeComponent.uuid) {
            if (c.kind === ComponentStateKind.Fragment) {
              console.error(
                "Error in setActiveComponentProps: The active component is a fragment and does not accept props."
              );
              return;
            } else {
              c.props = props;
              store.pendingChanges.pagesToUpdate.add(activePageName);
            }
          }
        });
      }),
  };

  const activeEntityFileActions = {
    setActiveEntityFile: (activeEntityFile?: string): boolean => {
      if (!activeEntityFile) {
        set({ activeEntityFile: undefined });
        return true;
      }
      const activePageName = get().activePageName;
      if (!activePageName) {
        console.error(
          `Error setting active entity file: no active page selected.`
        );
        return false;
      }
      if (get().pages[activePageName].entityFiles?.includes(activeEntityFile)) {
        set({ activeEntityFile });
        return true;
      }
      console.error(
        "Error setting active entity file:" +
          ` "${activeEntityFile}" is not an entity file for this page.`
      );
      return false;
    },
  };

  return {
    ...initialStates,
    ...pageActions,
    ...activePageActions,
    ...activeComponentActions,
    ...activeEntityFileActions,
  };
};

export default createPageSlice;
