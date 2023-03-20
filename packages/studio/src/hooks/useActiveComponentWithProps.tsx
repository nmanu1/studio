import { TypeGuards } from "@yext/studio-plugin";
import useActiveComponent from "./useActiveComponent";

export default function useActiveComponentWithProps() {
  const { activeComponentMetadata, activeComponentState } =
    useActiveComponent();

  if (!activeComponentMetadata?.propShape) {
    return null;
  }

  if (
    !activeComponentState ||
    !TypeGuards.isEditableComponentState(activeComponentState)
  ) {
    return null;
  }

  return {
    activeComponentMetadata,
    propShape: activeComponentMetadata.propShape,
    activeComponentState,
  };
}
