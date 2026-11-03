import { setGlobalOptions } from 'firebase-functions/v2';
import { FUNCTIONS_REGION } from '@petcare/shared';

setGlobalOptions({ region: FUNCTIONS_REGION, maxInstances: 10 });

export { deleteAccount } from './account/deleteAccount';
export { deletePet } from './pets/deletePet';
