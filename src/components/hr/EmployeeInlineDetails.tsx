import React from 'react';
import type { Employee } from '../../types';
import { RecordInlineField } from '../ui/RecordInlineField';
export function EmployeeInlineDetails({ employee }: { employee: Employee }) {
 return <div className="flex flex-col gap-1">{(['name', 'email', 'role'] as const).map(field => <RecordInlineField key={field} collection="employees" record={employee} field={field} kind={field === 'email' ? 'email' : 'text'} label={`${field === 'name' ? 'Name' : field === 'email' ? 'Email' : 'Role'} of ${employee.name}`} placeholder={`Add ${field}`} />)}</div>;
}
