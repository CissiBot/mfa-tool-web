import type { CardColor } from '../../lib/storage'

export const COLOR_COPY: Record<CardColor, { label: string; hint: string }> = {
  slate: { label: '石墨灰', hint: '低干扰、适合通用账号' },
  blue: { label: '控制台蓝', hint: '默认强调、适合高频账号' },
  green: { label: '完成绿', hint: '偏成功感、适合协作工具' },
  amber: { label: '提醒琥珀', hint: '适合高风险与支付场景' },
  rose: { label: '警示玫瑰', hint: '适合需要额外留意的账号' },
  violet: { label: '夜色紫', hint: '适合个人与创作类服务' },
}
