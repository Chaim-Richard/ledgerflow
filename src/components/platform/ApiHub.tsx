import { useApiHubModel } from './useApiHubModel';
import { ApiHubView } from './ApiHubView';
export default function ApiHub() {
 return <ApiHubView {...useApiHubModel()} />;
}
