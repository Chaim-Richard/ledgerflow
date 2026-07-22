import os

with open('src/lib/algorithms/index.ts', 'r') as f:
    content = f.read()

target_imports = "import { CATEGORIZATION_CONSISTENCY_ALGO } from './categorization-consistency';"
replacement_imports = """import { CATEGORIZATION_CONSISTENCY_ALGO } from './categorization-consistency';
import { SUBSET_SUM_RECONCILIATION } from './subset-sum';
import { RECURRENCE_DETECTION } from './recurrence';
import { TF_IDF_MATCHER } from './tf-idf';
import { FIND_MY_ERROR_ALGO } from './find-my-error';
import { RULE_INDUCTION_ALGO } from './rule-induction';
import { FENWICK_TIME_TRAVEL_ALGO } from './fenwick';"""

target_exports = """  'forensics_2': CATEGORIZATION_CONSISTENCY_ALGO,"""
replacement_exports = """  'forensics_2': CATEGORIZATION_CONSISTENCY_ALGO,
  'recon_1': SUBSET_SUM_RECONCILIATION,
  'planning_2': RECURRENCE_DETECTION,
  'ops_2': TF_IDF_MATCHER,
  'forensics_3': FIND_MY_ERROR_ALGO,
  'ops_3': RULE_INDUCTION_ALGO,
  'system_1': FENWICK_TIME_TRAVEL_ALGO,"""

content = content.replace(target_imports, replacement_imports)
content = content.replace(target_exports, replacement_exports)

with open('src/lib/algorithms/index.ts', 'w') as f:
    f.write(content)
