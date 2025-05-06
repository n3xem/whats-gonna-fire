// ワークフローのフィルタリングを担当するクラス
import { FilteredWorkflows, WorkflowsResponse } from './types';

export class WorkflowFilter {
    /**
     * .github/workflows内のワークフローだけをフィルタリング
     */
    static filterGitHubWorkflows(workflows: WorkflowsResponse): FilteredWorkflows {
        const filteredWorkflows: FilteredWorkflows = {
            total_count: 0,
            workflows: []
        };

        if (workflows.workflows && workflows.workflows.length > 0) {
            filteredWorkflows.workflows = workflows.workflows.filter(workflow =>
                workflow.path.startsWith('.github/workflows/')
            );
            filteredWorkflows.total_count = filteredWorkflows.workflows.length;
        }

        return filteredWorkflows;
    }
} 
