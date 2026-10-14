import React,{useMemo} from 'react';
import {useLedgerStore} from '../../stores/useLedgerStore';
import {useAuthStore} from '../../stores/useAuthStore';
import {useDataNeedsStore} from '../../stores/useDataNeedsStore';
import {useLedgerCollections} from '../../hooks/useLedgerCollections';
import {paymentMethodSummary} from '../../lib/paymentMethodSummary';
import {validCustomReportPeriod} from '../../lib/reportCustomPeriod';
import {formatCurrency} from '../../lib/utils';
import ReportTableScroll from './ReportTableScroll';
import PaymentFlowsByMethodPanel from './PaymentFlowsByMethodPanel';
export default function PaymentMethodSummaryView({startDate='',endDate='',compareStartDate='',compareEndDate=''}:{startDate?:string;endDate?:string;compareStartDate?:string;compareEndDate?:string}){
 const customers=useLedgerStore(state=>state.customers),payments=useLedgerStore(state=>state.payments),truncated=useLedgerStore(state=>state.truncatedCollections),failed=useDataNeedsStore(state=>state.failed);
 const workspace=useAuthStore(state=>state.currentWorkspaceId),currency=useAuthStore(state=>state.getCurrentWorkspace()?.currency);
 const {loading}=useLedgerCollections('customers','payments');
 const valid=validCustomReportPeriod({startDate,endDate}),compared=validCustomReportPeriod({startDate:compareStartDate,endDate:compareEndDate});
 const scoped=useMemo(()=>({customers:customers.filter(row=>!workspace||row.workspaceId===workspace),payments:payments.filter(row=>!workspace||row.workspaceId===workspace)}),[customers,payments,workspace]);
 const rows=useMemo(()=>valid&&!loading?paymentMethodSummary(scoped.customers,scoped.payments,{startDate,endDate}):[],[scoped,valid,loading,startDate,endDate]);
 const previous=useMemo(()=>new Map(compared&&!loading?paymentMethodSummary(scoped.customers,scoped.payments,{startDate:compareStartDate,endDate:compareEndDate}).map(row=>[row.id,row.cents]):[]),[scoped,compared,loading,compareStartDate,compareEndDate]);
 return <section aria-label="Sales payment summary" className="p-4 space-y-4 min-w-0"><h2>Sales payment summary by method</h2><p>{startDate} – {endDate}. Received customer payment documents, grouped by their stored method using the existing customer-payment report rules and base-currency conversion. Drafts, voids and outgoing payments are excluded. Includes unapplied receipts; this is a receipts summary, not sales revenue or invoice allocation. Undated documents follow the existing report rules and are counted explicitly.</p>{loading&&<p role="status">Loading payments…</p>}{!valid&&<p role="alert">Choose a valid report period.</p>}{(truncated.customers||truncated.payments||failed.customers||failed.payments)&&<p role="alert">Loaded payment history is incomplete or failed. These figures are provisional.</p>}<ReportTableScroll><table className="w-full text-sm"><caption>Customer receipts by method: {startDate} – {endDate}</caption><thead><tr><th scope="col">Method</th><th scope="col">Payments</th><th scope="col">Received</th><th scope="col">Undated included</th>{compared&&<th scope="col">Previous receipts / change</th>}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><th scope="row" className="text-left"><bdi>{row.name}</bdi></th><td>{row.count}</td><td>{formatCurrency(row.cents,currency)}</td><td>{row.undated}</td>{compared&&<td>{formatCurrency(previous.get(row.id)??0,currency)} / {formatCurrency(row.cents-(previous.get(row.id)??0),currency)}</td>}</tr>)}</tbody></table>{valid&&!loading&&!rows.length&&<p>No received payment documents for this period.</p>}</ReportTableScroll><PaymentFlowsByMethodPanel payments={payments} workspaceId={workspace||''} homeCurrency={currency||'USD'} startDate={startDate} endDate={endDate} loading={loading} incomplete={Boolean(truncated.payments||failed.payments)} /></section>;
}
