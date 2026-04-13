import {
  memoryStorageProvider,
  clearMemoryStorage,
} from '../../../app/storage/providers/memory.server.js';
import { storageContractTests } from '../../contracts/storage-contract.js';

storageContractTests(
  'Memory',
  () => memoryStorageProvider,
  async () => {
    // Clear memory storage before each test
    clearMemoryStorage();
  }
);
