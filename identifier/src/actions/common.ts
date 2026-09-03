import {
  asError,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATE,
  ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS,
  ExtendedError,
} from "../errors";
import type { AttemptResult, HelloResponse, StateResponse } from "../models/api";
import { newHelloRequest } from "../models/hello";
import { receiveError, receiveHello, resetHello } from "../reducers/common";
import type { AppThunk } from "../store";
import { withClientRequestState } from "../utils";
import type { PostJSONOptions } from "./utils";
import { isAbortError, postJSON } from "./utils";

export function executeHello(options: PostJSONOptions = {}): AppThunk<Promise<HelloResponse | undefined>> {
  return async (dispatch, _getState, request) => {
    dispatch(resetHello());

    const { flow, query } = request;

    const r = withClientRequestState(newHelloRequest(flow, query));
    try {
      const { status, data } = await postJSON("./identifier/_/hello", r, options);

      // This endpoint answers 200 for both signed-in and signed-out visitors.
      if (status !== 200) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, { status });
      }

      // The body is whatever the endpoint sent; the nonce comparison below is
      // what establishes that this reply answers this request.
      const hello = data as HelloResponse;
      if (hello.state !== r.state) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, { state: hello.state });
      }

      dispatch(receiveHello(hello));
      return hello;
    } catch (error) {
      if (isAbortError(error)) {
        return undefined;
      }

      dispatch(receiveError(asError(error)));
      return undefined;
    }
  };
}

export function retryHello(options: PostJSONOptions = {}): AppThunk<Promise<HelloResponse | undefined>> {
  return (dispatch) => {
    dispatch(receiveError(null));

    return dispatch(executeHello(options));
  };
}

export function executeLogoff(options: PostJSONOptions = {}): AppThunk<Promise<AttemptResult>> {
  return async (dispatch): Promise<AttemptResult> => {
    dispatch(resetHello());

    const r = withClientRequestState({});
    try {
      const { status, data } = await postJSON("./identifier/_/logoff", r, options);

      if (status !== 200) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATUS, { status });
      }

      const result = data as StateResponse;
      if (result.state !== r.state) {
        throw new ExtendedError(ERROR_HTTP_UNEXPECTED_RESPONSE_STATE, { state: result.state });
      }

      return result;
    } catch (error) {
      // Callers read success off the resolved value, so a failure has to be
      // reported as one rather than as undefined. An abort reports the same
      // shape without an error, because nobody asked to be told about it.
      if (isAbortError(error)) {
        return { success: false, errors: {} };
      }

      const failure = asError(error);
      dispatch(receiveError(failure));

      return {
        success: false,
        errors: {
          http: failure,
        },
      };
    }
  };
}
