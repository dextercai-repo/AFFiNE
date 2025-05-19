import { css } from '@emotion/css';
import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';

export const attachmentsWrapper = css({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  alignItems: 'center',
  padding: '8px',
  gap: '4px',
  isolation: 'isolate',
  border: `1px solid ${cssVar('borderColor')}`,
  borderRadius: '8px',
  flexGrow: 0,
  marginBottom: '16px',
});

export const attachmentItem = css({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px',
  gap: '4px',
  border: `0.5px solid ${cssVar('borderColor')}`,
  borderRadius: '4px',
  flex: 'none',
  alignSelf: 'stretch',
  flexGrow: 0,
});

export const attachmentTitle = css({
  fontSize: '14px',
  fontWeight: 400,
  color: cssVar('textPrimaryColor'),
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
});

export const attachmentOperation = css({
  display: 'flex',
  alignItems: 'center',
});

export const excludeDocsWrapper = css({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  alignItems: 'center',
  padding: '8px',
  gap: '4px',
  isolation: 'isolate',
  border: `1px solid ${cssVar('borderColor')}`,
  borderRadius: '8px',
  flexGrow: 0,
  marginBottom: '8px',
  overflowY: 'auto',
  maxHeight: '508px',
});

export const docItem = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  alignSelf: 'stretch',
  padding: '4px',
  borderRadius: '4px',
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      backgroundColor: cssVar('hoverColor'),
    },
  },
});

export const docItemTitle = css({
  fontSize: '14px',
  fontWeight: 500,
  color: cssVar('textPrimaryColor'),
  display: 'flex',
  alignItems: 'center',
});

export const docItemIcon = css({
  width: '20px',
  height: '20px',
  marginRight: '8px',
  color: cssVarV2('icon/primary'),
});

export const docItemInfo = css({
  display: 'flex',
  fontSize: '12px',
  fontWeight: 400,
  color: cssVar('textSecondaryColor'),
  gap: '12px',
  alignItems: 'center',
});

export const embeddingProgress = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
  paddingBottom: '16px',
  fontSize: '14px',
  fontWeight: 400,
  color: cssVar('textSecondaryColor'),
});

export const embeddingProgressTitle = css({
  textAlign: 'left',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});
