import { AppDispatch } from '@/store/store'
import { AWS_REGION, MQTT_ENDPOINT } from '@/constant'
import { PubSub, Auth } from 'aws-amplify'
import { AWSIoTProvider } from '@aws-amplify/pubsub'
import { attachPolicy } from '../libs/cognito'

export const UPDATE_IOT_CONNECTION_STATUS = 'UPDATE_IOT_CONNECTION_STATUS'

export const disconnectIoT = () => {
  return async (dispatch: AppDispatch) => {
    try {
      console.log('Disconnecting from IoT')
      if (PubSub) {
        PubSub.removePluggable('AWSIoTProvider')
      }
      dispatch({
        type: UPDATE_IOT_CONNECTION_STATUS,
        data: false,
      })
    } catch (error) {
      console.error('Error disconnecting from IoT:', error)
      dispatch({
        type: UPDATE_IOT_CONNECTION_STATUS,
        data: false,
      })
    }
  }
}

export const connectIoT = () => {
  return async (dispatch: AppDispatch) => {
    try {
      const currentUser = await Auth.currentCredentials()
      if (!currentUser.identityId) {
        throw new Error('No identity ID available')
      }

      dispatch({
        type: UPDATE_IOT_CONNECTION_STATUS,
        data: false,
      })

      console.log('Connecting to IoT')
      console.log(
        `AWS IoT logging, region:${AWS_REGION}, MQTT Endpoint: ${MQTT_ENDPOINT}`
      )

      // Remove existing provider if any
      if (PubSub) {
        PubSub.removePluggable('AWSIoTProvider')
      }

      // Attach IoT policy
      const policyAttached = await attachPolicy(currentUser.identityId)
      if (!policyAttached) {
        throw new Error('Failed to attach IoT policy')
      }

      // Add IoT provider
      PubSub.addPluggable(
        new AWSIoTProvider({
          aws_pubsub_region: AWS_REGION,
          aws_pubsub_endpoint: MQTT_ENDPOINT,
        })
      )

      dispatch({
        type: UPDATE_IOT_CONNECTION_STATUS,
        data: true,
      })
      console.log('Successfully connected to IoT')
    } catch (error) {
      console.error('Error connecting to IoT:', error)
      dispatch({
        type: UPDATE_IOT_CONNECTION_STATUS,
        data: false,
      })
      alert('Cannot connect to IoT. Please check your permissions and try again.')
    }
  }
}

export function setupIoTProvider() {
  try {
    PubSub.addPluggable(new AWSIoTProvider({
      aws_pubsub_region: AWS_REGION,
      aws_pubsub_endpoint: MQTT_ENDPOINT,
    }));
    console.log('IoT provider setup completed')
  } catch (error) {
    console.error('Error setting up IoT provider:', error)
  }
}
