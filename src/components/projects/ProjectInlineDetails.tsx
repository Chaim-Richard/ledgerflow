import React from 'react';
import { formatCurrency } from '../../lib/utils';
import type { Project } from '../../types';
import { RecordInlineField } from '../ui/RecordInlineField';
export function ProjectInlineDetails({ project }: { project: Project }) {
  return <div className="flex flex-wrap gap-3 text-xs">
    <span>Client: <RecordInlineField collection="projects" record={project} field="metadata.client" label={`Client of ${project.name}`} placeholder="Add client" /></span>
    <span>Budget: <RecordInlineField collection="projects" record={project} field="budgetCents" kind="money" display={formatCurrency(project.budgetCents || 0)} label={`Budget of ${project.name}`} /></span>
    <RecordInlineField collection="projects" record={project} field="status" kind="select" options={['active', 'completed', 'archived'].map(value => ({ value, label: value }))} label={`Status of ${project.name}`} />
  </div>;
}
