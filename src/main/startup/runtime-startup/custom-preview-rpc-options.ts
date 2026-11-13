import { getCustomBuildInfo } from '../../../shared/custom-build'
import { WS_BIND_HOST_LOOPBACK } from '../../runtime/rpc/server/runtime-rpc-pairing-types'
export function customPreviewRpcOptions(packaged: boolean, e2e: boolean) {
  return getCustomBuildInfo()?.profileMode === 'interactive-preview'
    ? { wsPort: 0, pinnedBindHost: WS_BIND_HOST_LOOPBACK, exposeNetworkByDefault: false }
    : !packaged && !e2e
      ? { wsPort: 6769 }
      : {}
}
