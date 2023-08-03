import {
  Classes,
  DndProvider,
  DropOptions,
  getBackendOptions,
  MultiBackend,
  NodeModel,
  PlaceholderRenderParams,
  RenderParams,
  Tree,
} from "@minoru/react-dnd-treeview";
import {
  ComponentState,
  ComponentTreeHelpers,
  TypeGuards,
} from "@yext/studio-plugin";
import { useCallback, useMemo, useState } from "react";
import {
  getComponentDisplayName,
  useComponentNames,
} from "../hooks/useActiveComponentName";
import useStudioStore from "../store/useStudioStore";
import ComponentNode from "./ComponentNode";

const ROOT_ID = "tree-root-uuid";
const TREE_CSS_CLASSES: Readonly<Classes> = {
  root: "overflow-x-auto py-2",
  placeholder: "relative",
  listItem: "relative",
};

/**
 * ComponentTree renders the active {@link PageState.componentTree}
 */
export default function ComponentTree(): JSX.Element | null {
  const tree: NodeModel<ComponentState>[] | undefined = useTree();
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [selectedComponentUUIDs] = useStudioStore((store) => {
    return [store.pages.selectedComponentUUIDs];
  });
  const initialOpen = useMemo(() => {
    return (
      tree?.reduce((prev, curr) => {
        if (!(curr.id in openIds) || openIds[curr.id]) {
          prev.push(curr.id);
        }
        return prev;
      }, [] as (string | number)[]) ?? []
    );
  }, [openIds, tree]);

  const handleDrop = useDropHandler();
  const renderDragPreview = useDragPreview();

  const onToggle = useCallback(
    (nodeId: string, newOpenValue: boolean) => {
      setOpenIds({
        ...openIds,
        [nodeId]: newOpenValue,
      });
    },
    [openIds, setOpenIds]
  );

  //move this back out of ComponentTree if we don't change it later, this could be where self insert bug gets fix
  const canDrop = useCallback((tree: NodeModel[], opts: DropOptions) => {
    const { dragSource, dropTarget, dropTargetId } = opts;
    if (dropTarget !== undefined && !dropTarget.droppable) {
      return false;
    }
    if (dragSource?.parent === dropTargetId || dropTargetId === ROOT_ID) {
      return true;
    }
    // For this drag and drop library, returning undefined has different behavior than returning false.
    // It means to use the default behavior.
    return undefined;
  }, []);

  // ask if this behavior makes sense. we would be unable to drag components that aren't highlighted
  // this is to prevent unselected components from being dropped in the middle of some selected components
  const canDrag = useCallback(
    (node: NodeModel<ComponentState> | undefined) => {
      if (node && selectedComponentUUIDs.includes(node.id.toString())) {
        return true;
      }
      return false;
    },
    [selectedComponentUUIDs]
  );

  const renderNodeCallback = useCallback(
    (node: NodeModel<ComponentState>, renderParams: RenderParams) => {
      const { depth, isOpen, hasChild } = renderParams;
      if (!node.data) {
        throw new Error(`Node missing data ${JSON.stringify(node, null, 2)}`);
      }
      return (
        <ComponentNode
          componentState={node.data}
          depth={depth}
          isOpen={isOpen}
          onToggle={onToggle}
          hasChild={hasChild}
        />
      );
    },
    [onToggle]
  );

  if (!tree) {
    return null;
  }

  return (
    <DndProvider backend={MultiBackend} options={getBackendOptions()}>
      <Tree
        tree={tree}
        rootId={ROOT_ID}
        classes={TREE_CSS_CLASSES}
        dropTargetOffset={4}
        initialOpen={initialOpen}
        sort={false}
        insertDroppableFirst={false}
        onDrop={handleDrop}
        canDrop={canDrop}
        canDrag={canDrag}
        render={renderNodeCallback}
        dragPreviewRender={renderDragPreview}
        placeholderRender={renderPlaceholder}
      />
    </DndProvider>
  );
}

function renderPlaceholder(_: NodeModel, { depth }: PlaceholderRenderParams) {
  const Placeholder = () => {
    const placeHolderStyle = useMemo(
      () => ({ left: `${depth}em`, width: `calc(100% - ${depth}em)` }),
      []
    );
    return (
      <div
        className="bg-rose-500 absolute h-0.5 z-10"
        style={placeHolderStyle}
      ></div>
    );
  };
  return <Placeholder />;
}

function useDragPreview() {
  const [selectedComponentUUIDs] = useStudioStore((store) => {
    return [store.pages.selectedComponentUUIDs];
  });
  const componentNames = useComponentNames(selectedComponentUUIDs);
  return () => (
    <div className="p-2 rounded bg-emerald-200 w-fit">
      {componentNames.map((name) => (
        <div className="flex">{name}</div>
      ))}
    </div>
  );
}

function useTree(): NodeModel<ComponentState>[] | undefined {
  const [componentTree, getFileMetadata] = useStudioStore((store) => {
    return [
      store.actions.getComponentTree(),
      store.fileMetadatas.getFileMetadata,
    ];
  });

  const tree = useMemo(() => {
    return componentTree?.map((componentState) => {
      const fileMetadata = componentState?.metadataUUID
        ? getFileMetadata(componentState.metadataUUID)
        : undefined;
      const droppable = TypeGuards.canAcceptChildren(
        componentState,
        fileMetadata
      );
      return {
        id: componentState.uuid,
        parent: componentState.parentUUID ?? ROOT_ID,
        data: componentState,
        text: getComponentDisplayName(componentState),
        droppable,
      };
    });
  }, [componentTree, getFileMetadata]);

  return tree;
}

// 1. DONE (hack out a solution, need to actually deal with the children problem)
// 3. DONE (drag previews)
// 4. whatever drag and drop does to the preview panel, figure out button and parent highlighting bug
// 4. don't let it drop into itself
// 4. test all

function useDropHandler() {
  const [
    selectedComponentUUIDs,
    componentTree,
    updateComponentTree,
    clearSelectedComponents,
    addSelectedComponentUUID,
  ] = useStudioStore((store) => {
    return [
      store.pages.selectedComponentUUIDs,
      store.actions.getComponentTree(),
      store.actions.updateComponentTree,
      store.pages.clearSelectedComponents,
      store.pages.addSelectedComponentUUID,
    ];
  });

  const handleDrop = useCallback(
    (tree: NodeModel<ComponentState>[], options) => {
      if (!componentTree) {
        throw new Error(
          "Unable to handle drag and drop event in ComponentTree: component tree is undefined."
        );
      }
      const { dragSourceId, destinationIndex } = options;
      const destinationParentId = tree[destinationIndex].parent.toString();
      const highestParentUUID = ComponentTreeHelpers.getHighestParentUUID(
        selectedComponentUUIDs.at(0),
        selectedComponentUUIDs.at(-1),
        componentTree
      );
      // this is assuming that selected components can't drop into themselves (canDrop) and
      // you can only highlight on one level (highlighters), and highlighting a container gets all the children too (highlighters)
      // don't let things get dropped in the middle of the selection
      let updatedComponentTree: ComponentState[] =
        convertNodeModelsToComponentTree(tree);

      const selectedComponents = componentTree
        .filter((c) => selectedComponentUUIDs.includes(c.uuid))
        .map((c) => {
          if (c.parentUUID !== highestParentUUID) return c;
          return {
            ...c,
            parentUUID:
              destinationParentId === ROOT_ID ? undefined : destinationParentId,
          };
        });
      updatedComponentTree = updatedComponentTree.filter(
        (c) =>
          c.uuid === dragSourceId || !selectedComponentUUIDs.includes(c.uuid)
      );
      let newDestinationIndex;
      updatedComponentTree.forEach((c, index) => {
        if (c.uuid === dragSourceId) {
          newDestinationIndex = index;
        }
      });
      updatedComponentTree.splice(
        newDestinationIndex,
        1,
        ...selectedComponents
      );

      clearSelectedComponents();
      selectedComponents.forEach((c) => addSelectedComponentUUID(c.uuid));
      updateComponentTree(updatedComponentTree);
    },
    [
      selectedComponentUUIDs,
      componentTree,
      updateComponentTree,
      clearSelectedComponents,
      addSelectedComponentUUID,
    ]
  );

  // do we need callback for this?? since its called in a callback?? also where should i put this - into helpers?
  function convertNodeModelsToComponentTree(tree: NodeModel<ComponentState>[]) {
    const updatedComponentTree: ComponentState[] = tree.map((n) => {
      if (!n.data) {
        throw new Error(
          "Unable to handle drag and drop event in ComponentTree: " +
            "No data passed into NodeModel<ComponentState> for node " +
            JSON.stringify(n, null, 2)
        );
      }
      const componentState: ComponentState = {
        ...n.data,
        parentUUID: n.parent.toString(),
      };
      if (componentState.parentUUID === ROOT_ID) {
        delete componentState.parentUUID;
      }
      return componentState;
    });
    return updatedComponentTree;
  }

  return handleDrop;
}
