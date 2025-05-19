import type { FilterParams } from '@affine/core/modules/collection-rules';
import type { DocRecord } from '@affine/core/modules/doc';
import type { I18nString } from '@affine/i18n';
import {
  DateTimeIcon,
  FavoriteIcon,
  HistoryIcon,
  MemberIcon,
  ShareIcon,
  TagIcon,
} from '@blocksuite/icons/rc';

import type { GroupHeaderProps } from '../explorer/types';
import { DateFilterMethod } from '../workspace-property-types';
import {
  CreateAtDocListProperty,
  CreatedAtFilterValue,
  CreatedAtGroupHeader,
  UpdatedAtDocListProperty,
  UpdatedAtFilterValue,
  UpdatedAtGroupHeader,
} from './created-updated-at';
import {
  CreatedByDocListInlineProperty,
  CreatedByUpdatedByFilterValue,
  ModifiedByGroupHeader,
  UpdatedByDocListInlineProperty,
} from './created-updated-by';
import { FavoriteFilterValue } from './favorite';
import { SharedFilterValue } from './shared';
import { TagsDocListProperty, TagsFilterValue, TagsGroupHeader } from './tags';

export const SystemPropertyTypes = {
  tags: {
    icon: TagIcon,
    name: 'Tags',
    filterMethod: {
      include: 'com.affine.filter.contains all',
      'is-not-empty': 'com.affine.filter.is not empty',
      'is-empty': 'com.affine.filter.is empty',
    },
    filterValue: TagsFilterValue,
    allowInGroupBy: true,
    allowInOrderBy: true,
    defaultFilter: { method: 'is-not-empty' },
    showInDocList: 'stack',
    docListProperty: TagsDocListProperty,
    groupHeader: TagsGroupHeader,
  },
  createdBy: {
    icon: MemberIcon,
    name: 'com.affine.page-properties.property.createdBy',
    allowInGroupBy: true,
    allowInOrderBy: true,
    filterMethod: {
      include: 'com.affine.filter.contains all',
    },
    filterValue: CreatedByUpdatedByFilterValue,
    defaultFilter: { method: 'include', value: '' },
    showInDocList: 'inline',
    docListProperty: CreatedByDocListInlineProperty,
    groupHeader: ModifiedByGroupHeader,
  },
  updatedBy: {
    icon: MemberIcon,
    name: 'com.affine.page-properties.property.updatedBy',
    allowInGroupBy: true,
    allowInOrderBy: true,
    filterMethod: {
      include: 'com.affine.filter.contains all',
    },
    filterValue: CreatedByUpdatedByFilterValue,
    defaultFilter: { method: 'include', value: '' },
    showInDocList: 'inline',
    docListProperty: UpdatedByDocListInlineProperty,
    groupHeader: ModifiedByGroupHeader,
  },
  updatedAt: {
    icon: DateTimeIcon,
    name: 'com.affine.page-properties.property.updatedAt',
    allowInGroupBy: true,
    allowInOrderBy: true,
    filterMethod: {
      ...DateFilterMethod,
    },
    filterValue: UpdatedAtFilterValue,
    defaultFilter: { method: 'this-week' },
    showInDocList: 'inline',
    docListProperty: UpdatedAtDocListProperty,
    groupHeader: UpdatedAtGroupHeader,
  },
  createdAt: {
    icon: HistoryIcon,
    name: 'com.affine.page-properties.property.createdAt',
    allowInGroupBy: true,
    allowInOrderBy: true,
    filterMethod: {
      ...DateFilterMethod,
    },
    filterValue: CreatedAtFilterValue,
    defaultFilter: { method: 'this-week' },
    showInDocList: 'inline',
    docListProperty: CreateAtDocListProperty,
    groupHeader: CreatedAtGroupHeader,
  },
  favorite: {
    icon: FavoriteIcon,
    name: 'Favorited',
    filterMethod: {
      is: 'com.affine.filter.is',
    },
    filterValue: FavoriteFilterValue,
  },
  shared: {
    icon: ShareIcon,
    name: 'Shared',
    filterMethod: {
      is: 'com.affine.filter.is',
    },
    filterValue: SharedFilterValue,
  },
} as {
  [type: string]: {
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    name: I18nString;

    allowInOrderBy?: boolean;
    allowInGroupBy?: boolean;
    filterMethod: { [key: string]: I18nString };
    filterValue: React.FC<{
      filter: FilterParams;
      onChange: (filter: FilterParams) => void;
    }>;
    defaultFilter?: Omit<FilterParams, 'type' | 'key'>;
    /**
     * Whether to show the property in the doc list,
     * - `inline`: show the property in the doc list inline
     * - `stack`: show as tags
     */
    showInDocList?: 'inline' | 'stack';
    docListProperty?: React.FC<{ doc: DocRecord }>;
    groupHeader?: React.FC<GroupHeaderProps>;
  };
};

export type SystemPropertyType = keyof typeof SystemPropertyTypes;

export const isSupportedSystemPropertyType = (type?: string) => {
  return type ? type in SystemPropertyTypes : false;
};
