/**
 * InMemoryMixRepository runs the shared MixRepository contract.
 */

import { InMemoryMixRepository } from '../in-memory-repo'
import { runRepositoryContract } from '../repository-contract'

runRepositoryContract('InMemoryMixRepository', {
  create: async () => new InMemoryMixRepository(),
})
