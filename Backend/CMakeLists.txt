cmake_minimum_required(VERSION 3.10)
project(daa_backend)

set(CMAKE_CXX_STANDARD 17)

include_directories(lib)

add_executable(daa_backend main.cpp)
if(WIN32)
    target_link_libraries(daa_backend ws2_32 wsock32)
endif()
