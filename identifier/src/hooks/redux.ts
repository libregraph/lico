import type { TypedUseSelectorHook } from "react-redux";
import { useDispatch, useSelector } from "react-redux";

import type { AppDispatch, RootState } from "../store";

/*
 * The store aware versions of the two react-redux hooks. Components use these
 * so the state shape is named once here instead of at every selector, and so
 * dispatching a thunk type checks.
 */
export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
