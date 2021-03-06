'use strict'

const User = use('App/Models/User')
const NotFoundException = use('App/Exceptions/NotFoundException')

class FindUser {
  async handle ({ request, params: { id } }, next) {
    // call next to advance the request
    try {
      const user = await User.findOrFail(id)
      request.body.user = user
    } catch (error) {
      throw new NotFoundException(`User with id - ${id} not found`, 404)
    }
    await next()
  }
}

module.exports = FindUser
