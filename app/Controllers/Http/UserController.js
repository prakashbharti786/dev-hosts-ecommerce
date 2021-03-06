'use strict'

const User = use('App/Models/User')
const NotFoundException = use('App/Exceptions/NotFoundException')
const NotAuthenticatedException = use('App/Exceptions/NotAuthenticatedException')
const BlackListedToken = use('App/Models/BlackListedToken')
const userFields = ['first-name', 'last-name', 'email', 'password', 'charge-per-month']

class UserController {
  async login({ auth, request, response }) {
    const { email, password } = request.post()
    try {
      const jwt = await auth.withRefreshToken().attempt(email, password)
      const user = await User.findBy({ email })
      response
        .status(200)
        .json({
          data: {
            token: jwt,
            user
          },
          successful: true,
          errors: []
        })
    } catch (error) {
      throw error
    }
  }

  async refreshToken({ auth, request }) {
    const refreshToken = request.input('refresh-token')
    try {
      const token = await auth.generateForRefreshToken(refreshToken)
      return {
        successful: true,
        errors: [],
        data: token
      }
    } catch (error) {
      const [ , message ] = error.message.split(`${error.code}: `)
      
      if(message.includes('undefined'))
        throw new NotAuthenticatedException('Please specify the refresh-token sent back when you logged in')
      
      throw new NotAuthenticatedException(message, 401)
    }
  }

  async logout({ auth }) {
    const user = await auth.getUser()
    const token = auth.getAuthHeader()
    await auth.revokeTokensForUser(user)

    await BlackListedToken.create({ token })

    return {
      successful: true,
      errors: [],
      data: {
        message: 'Logout successfully'
      }
    }
  }

  async store ({ request, response, auth }) {
    const data = request.only(userFields.filter(field => !field.includes('charge-per-month')))
    const user = await User.create(data)

    const token = await auth.withRefreshToken().generate(user)

    return response
      .status(201)
      .json({
        errors: [],
        successful: true,
        data: { user, token }
      })
  }

  async show ({ request }) {
    const { user } = request.post()

    const [ services, servers, storageCenters ] = await Promise.all([
      user.services().with('group').fetch(),
      user.servers().fetch(),
      user.storageCenters().fetch()
    ])

    user.services = services
    user.servers = servers
    user['data-storage'] = storageCenters

    return {
      errors: [],
      successful: true,
      data: user
    }
  }

  async update ({ request }) {
    const { user, services, servers, storage } = request.post()

    const fields = userFields.filter(field => !field.includes('role'))
    const data = request.only(fields)
    
    if(services) {
      await user.services().detach()
      try {
        await user.services().attach(services)
      } catch (error) {
        throw new NotFoundException('Service not found', 404)
      }
    }
    if(servers) {
      await user.servers().detach()
      try {
        await user.servers().attach(servers)
      } catch (error) {
        throw new NotFoundException('Server not found', 404)
      }
    }
    if(storage) {
      await user.storageCenters().detach()
      try {
        await user.storageCenters().attach(storage)
      } catch (error) {
        throw new NotFoundException('Storage center not found', 404)
      }
    }

    const [ userServices, userServers, userStorageCenters ] = await Promise.all([
      user.services().with('group').fetch(),
      user.servers().fetch(),
      user.storageCenters().fetch()
    ])

    user.merge(data)

    await user.save()

    user.services = userServices
    user.servers = userServers
    user['data-storage'] = userStorageCenters

    return {
      successful: true,
      errors: [],
      data: user
    }
  }

  async destroy ({ request }) {
    const { user } = request.post()

    const [ services, servers, storageCenters ] = await Promise.all([
      user.services().fetch(),
      user.servers().fetch(),
      user.storageCenters().fetch()
    ])

    user.servers = servers
    user.services = services
    user['data-storage'] = storageCenters

    await user.delete()

    return {
      successful: true,
      errors: [],
      data: user
    }
  }
}

module.exports = UserController
