"use client"
import { connect } from 'react-redux'
import { Icon } from '@mdi/react'
import {
  mdiEmoticonSad,
  mdiEmoticon,
  mdiEmoticonHappy,
  mdiEmoticonNeutral,
  mdiEmoticonFrown,
} from '@mdi/js'
import { RootState } from '@/store/store'

const getIconData = (type: number) => {
  switch (type) {
    case 3:
      return {
        icon: mdiEmoticonSad,
        color: 'text-blue-500',
      }
    case 4:
      return {
        icon: mdiEmoticonFrown,
        color: 'text-red-500',
      }
    case 2:
      return {
        icon: mdiEmoticon,
        color: 'text-yellow-500',
      }
    case 1:
      return {
        icon: mdiEmoticonHappy,
        color: 'text-green-400',
      }
    default:
      return {
        icon: mdiEmoticonNeutral,
        color: 'text-gray-500',
      }
  }
}

const EmotionIcon = (props: { latestEmotion: number }) => {
  return (
    <>
      <div className="tooltip emotion-icon-responsive">
        <Icon
          className={`${getIconData(props.latestEmotion).color}`}
          style={{ width: 40, height: 40, display: 'block' }}
          path={getIconData(props.latestEmotion).icon}
        />
        <span className="tooltiptext">{props.latestEmotion}</span>
      </div>
      <style>{`
        @media (max-width: 700px) {
          .emotion-icon-responsive svg {
            width: 32px !important;
            height: 32px !important;
          }
        }
      `}</style>
    </>
  )
}
  
const mapStateToProps = (state: RootState) => {
  return {
    latestEmotion: state.latestEmotion,
  }
}
  
export default connect(mapStateToProps)(EmotionIcon)