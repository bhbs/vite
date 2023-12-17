import type { OutputBundle, OutputChunk } from 'rollup'
import MagicString from 'magic-string'
import { getHash } from '../utils'
import type { Plugin } from '../plugin'
import type { ResolvedConfig } from '../config'

const hashPlaceholderLeft = '!~{'
const hashPlaceholderRight = '}~'
const hashPlaceholderOverhead =
  hashPlaceholderLeft.length + hashPlaceholderRight.length
export const maxHashSize = 22
// from https://github.com/rollup/rollup/blob/fbc25afcc2e494b562358479524a88ab8fe0f1bf/src/utils/hashPlaceholders.ts#L41-L46
const REPLACER_REGEX = new RegExp(
  // eslint-disable-next-line regexp/strict, regexp/prefer-d, regexp/prefer-w
  `${hashPlaceholderLeft}[0-9a-zA-Z_$]{1,${
    maxHashSize - hashPlaceholderOverhead
  }}${hashPlaceholderRight}`,
  'g',
)

const hashPlaceholderToFacadeModuleIdHashMap: Map<string, string> = new Map()

function augmentFacadeModuleIdHash(name: string): string {
  return name.replace(
    REPLACER_REGEX,
    (match) => hashPlaceholderToFacadeModuleIdHashMap.get(match) ?? match,
  )
}

export function createChunkMap(
  bundle: OutputBundle,
  base: string = '',
): Record<string, string> {
  return Object.fromEntries(
    Object.values(bundle)
      .filter((chunk): chunk is OutputChunk => chunk.type === 'chunk')
      .map((output) => {
        return [
          base + augmentFacadeModuleIdHash(output.preliminaryFileName),
          base + output.fileName,
        ]
      }),
  )
}

export function chunkMapPlugin(config: ResolvedConfig): Plugin {
  return {
    name: 'vite:chunk-map',

    renderChunk(code, _chunk, _options, meta) {
      Object.values(meta.chunks).forEach((chunk) => {
        const hashPlaceholder = chunk.fileName.match(REPLACER_REGEX)?.[0]
        if (!hashPlaceholder) return
        if (hashPlaceholderToFacadeModuleIdHashMap.get(hashPlaceholder)) return

        hashPlaceholderToFacadeModuleIdHashMap.set(
          hashPlaceholder,
          getHash(chunk.facadeModuleId ?? chunk.fileName),
        )
      })

      const codeProcessed = augmentFacadeModuleIdHash(code)
      return {
        code: codeProcessed,
        map: new MagicString(codeProcessed).generateMap({
          hires: 'boundary',
        }),
      }
    },
  }
}
