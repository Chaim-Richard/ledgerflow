/**
 * Warehouse operations workflows (A-64–A-67).
 *
 * This module derives pick quantities from the existing sales-order, invoice and delivery records.
 * Bin assignments and shipment annotations are operational metadata only: none of these helpers
 * posts money or changes stock quantities.
 */
import type { DimensionNode, Estimate, EntityMetadata, Invoice, InventoryItem, Transaction } from '../types';
import { deliveredByLine, deliveryLines, orderDeliveries, type GoodsLeaveWith } from './deliveries';
import { isOrder, orderLineProgress, orderProgress } from './salesOrders';
import {
  displayName, encodedPathPart, hasControlCharacters, isIsoDate, isIsoTime, isPlainRecord, isWorkspaceWriter,
  type WorkflowActor,
} from './warehouseRecordUtils';

export const BIN_LOCATIONS_FIELD = 'binLocations';
export const SHIPMENTS_METADATA_FIELD = 'warehouseShipmentsBySource';
export const NO_LOCATION_VALUE = '__no_location__';

const UNISSUED_INVOICE_STATUSES = new Set(['draft', 'rejected', 'void', 'cancelled']);

export interface PickListLine {
  orderId: string;
  orderNumber: string;
  customerName: string;
  linePosition: number;
  itemId: string;
  description: string;
  sku: string;
  locationId: string;
  locationName: string;
  bin: string;
  quantityToPick: number;
}

export interface ShipmentLine {
  itemId: string;
  description: string;
  sku: string;
  quantity: number;
  orderLine: number | null;
}

export interface ShipmentSource {
  sourceType: 'delivery' | 'invoice';
  sourceId: string;
  sourceNumber: string;
  date: string;
  label: string;
  lines: ShipmentLine[];
}

export interface ShipmentRecord extends ShipmentSource {
  id: string;
  workspaceId: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  shippedDate: string;
  recordedAt: string;
  recordedByUid: string;
  recordedByName: string;
}

export function binLocationKey(locationId: string): string {
  const clean = String(locationId ?? '').trim();
  return clean ? `loc_${encodedPathPart(clean)}` : '';
}

export function binLocationFieldPath(locationId: string): string {
  const key = binLocationKey(locationId);
  return key ? `${BIN_LOCATIONS_FIELD}.${key}` : '';
}

export function binLocationProblem(locationId: string, bin: string): string | null {
  const cleanLocation = String(locationId ?? '').trim();
  const cleanBin = String(bin ?? '').trim();
  if (!cleanLocation) return 'Choose a Location before assigning a bin.';
  if (cleanLocation.length > 200 || hasControlCharacters(cleanLocation)) return 'That Location value cannot be used for a bin assignment.';
  if (cleanBin.length > 80) return 'A bin label can be up to 80 characters.';
  if (hasControlCharacters(cleanBin)) return 'A bin label cannot contain control characters.';
  return null;
}

export function itemBinForLocation(item: InventoryItem, locationId: string): string {
  const value = item.binLocations?.[binLocationKey(locationId)];
  if (!value || value.locationId !== locationId || typeof value.bin !== 'string') return '';
  return value.bin;
}

function stockItemsById(items: InventoryItem[]): Map<string, InventoryItem> {
  return new Map(items.filter(item => item && typeof item.id === 'string').map(item => [item.id, item]));
}

function eligibleOrderInvoices(order: Estimate, invoices: Invoice[]): Invoice[] {
  return invoices.filter(invoice =>
    invoice.workspaceId === order.workspaceId &&
    invoice.metadata?.convertedFromEstimateId === order.id &&
    !UNISSUED_INVOICE_STATUSES.has(String(invoice.status).toLowerCase()),
  );
}

/**
 * Open item quantities by bin for one Location. Invoice mode counts issued invoices only; delivery
 * mode counts posted deliveries less posted returns using the existing stock-movement records.
 */
export function buildWarehousePickList(
  order: Estimate,
  invoices: Invoice[],
  transactions: Transaction[],
  items: InventoryItem[],
  locationId: string,
  mode: GoodsLeaveWith,
  nodes: DimensionNode[] = [],
): PickListLine[] {
  if (!locationId || locationId === NO_LOCATION_VALUE || !isOrder(order)) return [];
  const itemById = stockItemsById(items);
  const progressInvoices = eligibleOrderInvoices(order, invoices);
  const openLines = mode === 'delivery'
    ? deliveryLines(order, deliveredByLine(transactions.filter(transaction => transaction.workspaceId === order.workspaceId), order.id)).map(line => ({
      position: line.position,
      itemId: line.itemId,
      description: line.description,
      quantityToPick: line.left,
    }))
    : orderLineProgress(order, orderProgress(order, progressInvoices)).map(line => ({
      position: line.position,
      itemId: line.itemId || '',
      description: line.description,
      quantityToPick: line.leftQuantity,
    }));
  const locationName = nodes.find(node => node.dimensionId === 'location' && node.id === locationId)?.description || locationId;
  const rows: PickListLine[] = [];
  for (const line of openLines) {
    if (!line.itemId || !Number.isFinite(line.quantityToPick) || line.quantityToPick <= 0) continue;
    const item = itemById.get(line.itemId);
    if (item?.itemType === 'service') continue;
    rows.push({
      orderId: order.id,
      orderNumber: order.number || order.id,
      customerName: order.customerName || '',
      linePosition: line.position,
      itemId: line.itemId,
      description: line.description || item?.name || 'Inventory item',
      sku: item?.sku || '',
      locationId,
      locationName,
      bin: item ? itemBinForLocation(item, locationId) : '',
      quantityToPick: line.quantityToPick,
    });
  }
  return rows.sort((a, b) =>
    (a.bin ? 0 : 1) - (b.bin ? 0 : 1) ||
    a.bin.localeCompare(b.bin, undefined, { numeric: true, sensitivity: 'base' }) ||
    a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' }) ||
    a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true, sensitivity: 'base' }) ||
    a.linePosition - b.linePosition,
  );
}

function orderLineForInvoiceItem(order: Estimate, item: NonNullable<Invoice['items']>[number]): number | null {
  const supplied = Number(item.metadata?.orderLine);
  if (Number.isInteger(supplied) && supplied >= 0 && supplied < order.lines.length && order.lines[supplied]?.itemId === item.itemId) return supplied;
  const matches = order.lines.flatMap((line, position) => line.itemId === item.itemId ? [position] : []);
  return matches.length === 1 ? matches[0] : null;
}

function invoiceIsIssued(invoice: Invoice): boolean {
  return !UNISSUED_INVOICE_STATUSES.has(String(invoice.status).toLowerCase());
}

/** Fulfilment records that already exist; this function never creates a delivery or invoice. */
export function shipmentSourcesForOrder(
  order: Estimate,
  invoices: Invoice[],
  transactions: Transaction[],
  items: InventoryItem[],
  mode: GoodsLeaveWith,
): ShipmentSource[] {
  if (!isOrder(order)) return [];
  const itemById = stockItemsById(items);
  if (mode === 'delivery') {
    return orderDeliveries(transactions.filter(transaction => transaction.workspaceId === order.workspaceId), order.id).map(delivery => {
      const lines = delivery.lines.flatMap(line => {
        if (!line.itemId || !(line.quantity > 0)) return [];
        const orderLine = order.lines[line.position];
        const item = itemById.get(line.itemId);
        if (item?.itemType === 'service') return [];
        return [{
          itemId: line.itemId,
          description: orderLine?.description || item?.name || 'Inventory item',
          sku: item?.sku || '',
          quantity: line.quantity,
          orderLine: Number.isInteger(line.position) ? line.position : null,
        }];
      });
      return {
        sourceType: 'delivery' as const,
        sourceId: delivery.deliveryId,
        sourceNumber: delivery.deliveryId,
        date: delivery.date,
        label: `Delivery ${delivery.deliveryId}`,
        lines,
      };
    }).filter(source => source.lines.length > 0);
  }

  return invoices
    .filter(invoice => invoice.workspaceId === order.workspaceId && invoiceIsIssued(invoice) && invoice.metadata?.convertedFromEstimateId === order.id)
    .map(invoice => {
      const lines = (invoice.items || []).flatMap(item => {
        if (!item.itemId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) return [];
        const inventoryItem = itemById.get(item.itemId);
        if (inventoryItem?.itemType === 'service') return [];
        return [{
          itemId: item.itemId,
          description: item.description || inventoryItem?.name || 'Inventory item',
          sku: inventoryItem?.sku || '',
          quantity: Number(item.quantity),
          orderLine: orderLineForInvoiceItem(order, item),
        }];
      });
      return {
        sourceType: 'invoice' as const,
        sourceId: invoice.id,
        sourceNumber: invoice.number || invoice.id,
        date: String(invoice.date || '').slice(0, 10),
        label: `Invoice ${invoice.number || invoice.id}`,
        lines,
      };
    })
    .filter(source => source.lines.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.sourceNumber.localeCompare(b.sourceNumber));
}

export function shipmentSourceKey(sourceType: ShipmentSource['sourceType'], sourceId: string): string {
  return `${sourceType}_${encodedPathPart(String(sourceId ?? '').trim())}`;
}

export function shipmentFieldPath(sourceType: ShipmentSource['sourceType'], sourceId: string): string {
  const key = shipmentSourceKey(sourceType, sourceId);
  return key.endsWith('_') ? '' : `metadata.${SHIPMENTS_METADATA_FIELD}.${key}`;
}

export function shipmentDateProblem(shippedDate: string, today: string): string | null {
  if (!isIsoDate(shippedDate)) return 'Enter a valid shipment date.';
  if (!isIsoDate(today)) return 'The current date is not available; reload and try again.';
  if (shippedDate > today) return 'A shipment date cannot be in the future.';
  return null;
}

export function shipmentProblem(input: {
  source?: ShipmentSource | null;
  existing?: ShipmentRecord | null;
  carrier: string;
  trackingNumber: string;
  shippedDate: string;
  today: string;
}): string | null {
  if (!input.source) return 'Choose an existing delivery or issued invoice first.';
  if (!input.source.lines.length) return 'That fulfilment record has no stock item lines.';
  if (input.existing) return 'This delivery or invoice already has a shipment record.';
  const carrier = String(input.carrier ?? '').trim();
  const trackingNumber = String(input.trackingNumber ?? '').trim();
  if (!carrier) return 'Enter the carrier.';
  if (carrier.length > 80 || hasControlCharacters(carrier)) return 'Carrier must be 80 characters or fewer and contain no control characters.';
  if (!trackingNumber) return 'Enter the tracking number.';
  if (trackingNumber.length > 120 || hasControlCharacters(trackingNumber)) return 'Tracking number must be 120 characters or fewer and contain no control characters.';
  return shipmentDateProblem(input.shippedDate, input.today);
}

export function createShipmentRecord(input: {
  id: string;
  workspaceId: string;
  orderId: string;
  source: ShipmentSource;
  carrier: string;
  trackingNumber: string;
  shippedDate: string;
  recordedAt: string;
  actor: WorkflowActor;
}): ShipmentRecord {
  if (!input.id.trim() || input.id.length > 120 || hasControlCharacters(input.id) ||
    !input.workspaceId.trim() || !input.orderId.trim() || !isWorkspaceWriter(input.actor) || !isIsoTime(input.recordedAt)) {
    throw new Error('A valid shipment record identity, workspace and editor are required.');
  }
  const problem = shipmentProblem({
    source: input.source,
    carrier: input.carrier,
    trackingNumber: input.trackingNumber,
    shippedDate: input.shippedDate,
    today: input.shippedDate,
  });
  if (problem) throw new Error(problem);
  return {
    ...input.source,
    id: input.id,
    workspaceId: input.workspaceId,
    orderId: input.orderId,
    carrier: input.carrier.trim(),
    trackingNumber: input.trackingNumber.trim(),
    shippedDate: input.shippedDate,
    recordedAt: input.recordedAt,
    recordedByUid: input.actor.uid,
    recordedByName: displayName(input.actor.name),
  };
}

function validShipmentLine(value: unknown): value is ShipmentLine {
  return isPlainRecord(value) && typeof value.itemId === 'string' && Boolean(value.itemId.trim()) &&
    typeof value.description === 'string' && typeof value.sku === 'string' &&
    typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity > 0 &&
    (value.orderLine === null || Number.isInteger(value.orderLine) && Number(value.orderLine) >= 0);
}

export function shipmentRecordsFromMetadata(metadata: EntityMetadata | undefined): ShipmentRecord[] {
  const raw = metadata?.[SHIPMENTS_METADATA_FIELD];
  if (!isPlainRecord(raw)) return [];
  return Object.entries(raw).flatMap(([key, value]) => {
    if (!isPlainRecord(value)) return [];
    const record = value as unknown as ShipmentRecord;
    if (
      typeof record.id !== 'string' || !record.id.trim() || typeof record.sourceId !== 'string' || !record.sourceId.trim() ||
      (record.sourceType !== 'delivery' && record.sourceType !== 'invoice') ||
      key !== shipmentSourceKey(record.sourceType, record.sourceId) ||
      typeof record.sourceNumber !== 'string' || typeof record.label !== 'string' || typeof record.date !== 'string' ||
      typeof record.orderId !== 'string' || !record.orderId.trim() || typeof record.workspaceId !== 'string' || !record.workspaceId.trim() ||
      !isIsoDate(record.shippedDate) || typeof record.carrier !== 'string' || record.carrier.length > 80 ||
      typeof record.trackingNumber !== 'string' || record.trackingNumber.length > 120 ||
      typeof record.recordedByUid !== 'string' || typeof record.recordedByName !== 'string' ||
      !Array.isArray(record.lines) || record.lines.length === 0 || !record.lines.every(validShipmentLine) || !isIsoTime(record.recordedAt)
    ) return [];
    return [record];
  }).sort((a, b) => b.shippedDate.localeCompare(a.shippedDate) || b.recordedAt.localeCompare(a.recordedAt));
}

export function shipmentForSource(
  metadata: EntityMetadata | undefined,
  source: Pick<ShipmentSource, 'sourceType' | 'sourceId'>,
): ShipmentRecord | null {
  return shipmentRecordsFromMetadata(metadata).find(record =>
    record.sourceType === source.sourceType && record.sourceId === source.sourceId,
  ) || null;
}

/** Human-readable Location options, including a previously assigned label if its node was archived. */
export function warehouseLocationOptions(nodes: DimensionNode[], items: InventoryItem[]): DimensionNode[] {
  const active = nodes.filter(node => node.dimensionId === 'location' && node.status !== 'archived');
  const knownIds = new Set(active.map(node => node.id));
  const archived = nodes.filter(node => node.dimensionId === 'location' && node.status === 'archived');
  const assignedIds = new Set(items.flatMap(item => Object.values(item.binLocations || {}).map(value => value.locationId)));
  return [
    ...active,
    ...archived.filter(node => assignedIds.has(node.id) && !knownIds.has(node.id)),
  ].sort((a, b) => a.description.localeCompare(b.description, undefined, { sensitivity: 'base' }));
}

/** The set of accepted sales orders in the current workspace. */
export function warehouseOrders(estimates: Estimate[], workspaceId: string): Estimate[] {
  return estimates
    .filter(order => order.workspaceId === workspaceId && isOrder(order))
    .sort((a, b) => String(a.number || a.id).localeCompare(String(b.number || b.id), undefined, { numeric: true, sensitivity: 'base' }));
}

/** For a quick screen summary: how many stock lines are waiting to be picked. */
export function pickListQuantity(rows: PickListLine[]): number {
  return rows.reduce((total, row) => total + row.quantityToPick, 0);
}
