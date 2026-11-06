// A região e as demais opções vêm de ./config (callableOptions), aplicadas em cada função.
export { deleteAccount } from './account/deleteAccount';
export { deletePet } from './pets/deletePet';
export { importRga } from './rga/importRga';
export { searchPlaces } from './places/searchPlaces';
export { suggestPlace } from './places/suggestPlace';
export {
  attachReportPhotos,
  createAdoption,
  createReport,
  createRescueAlert,
  deleteAdoption,
  deleteRescueAlert,
  updateAdoption,
  updateRescueAlert,
} from './centrals/callables';
